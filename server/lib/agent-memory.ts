import db from '../db/database.js';

export type MemoryType = 'style' | 'faq' | 'pattern' | 'client_insight';

export interface BusinessMemory {
    id: number;
    business_id: number;
    type: MemoryType;
    content: string;
    source: 'auto_learned' | 'manual';
    relevance: number;
    created_at: string;
}

/**
 * Store a new memory for a business.
 * If a very similar memory already exists (same type + first 60 chars match), skip.
 */
export async function storeMemory(
    businessId: number,
    type: MemoryType,
    content: string,
    source: 'auto_learned' | 'manual' = 'auto_learned',
    relevance = 5,
): Promise<void> {
    try {
        // Dedup check: avoid storing near-identical memories
        const prefix = content.substring(0, 60);
        const { rows } = await db.query(
            'SELECT id FROM business_memories WHERE business_id = $1 AND type = $2 AND content ILIKE $3 LIMIT 1',
            [businessId, type, `${prefix}%`],
        );
        if (rows.length > 0) return; // Already know this

        await db.query(
            'INSERT INTO business_memories (business_id, type, content, source, relevance) VALUES ($1, $2, $3, $4, $5)',
            [businessId, type, content, source, relevance],
        );
        console.log(`[AgentMemory] Stored ${type} memory for business ${businessId}`);
    } catch (err) {
        console.error('[AgentMemory] storeMemory error:', err);
    }
}

/**
 * Retrieve the most relevant memories for a business.
 * Simple keyword-based relevance: prioritize higher relevance score + FAQs.
 */
export async function getMemories(
    businessId: number,
    keywords: string[] = [],
    limit = 8,
): Promise<BusinessMemory[]> {
    try {
        // First get all memories for this business, sorted by relevance
        const { rows } = await db.query(
            'SELECT * FROM business_memories WHERE business_id = $1 ORDER BY relevance DESC, created_at DESC LIMIT 30',
            [businessId],
        );

        if (rows.length === 0) return [];

        // If keywords provided, score by keyword matches and take top N
        if (keywords.length > 0) {
            const lowerKeywords = keywords.map((k) => k.toLowerCase());
            const scored = rows.map((mem: BusinessMemory) => {
                const lowerContent = mem.content.toLowerCase();
                const score = lowerKeywords.filter((kw) => lowerContent.includes(kw)).length;
                return { ...mem, _score: score + mem.relevance };
            });
            scored.sort((a: any, b: any) => b._score - a._score);
            return scored.slice(0, limit);
        }

        return rows.slice(0, limit);
    } catch (err) {
        console.error('[AgentMemory] getMemories error:', err);
        return [];
    }
}

/**
 * Format memories as a string to inject into an AI prompt.
 */
export function formatMemoriesForPrompt(memories: BusinessMemory[]): string {
    if (memories.length === 0) return '';

    const grouped: Record<string, string[]> = {};
    for (const mem of memories) {
        if (!grouped[mem.type]) grouped[mem.type] = [];
        grouped[mem.type].push(mem.content);
    }

    const sections: string[] = [];

    if (grouped['style']?.length) {
        sections.push(`ESTILO DEL DUEÑO:\n${grouped['style'].map((s) => `• ${s}`).join('\n')}`);
    }
    if (grouped['faq']?.length) {
        sections.push(`PREGUNTAS FRECUENTES:\n${grouped['faq'].map((s) => `• ${s}`).join('\n')}`);
    }
    if (grouped['pattern']?.length) {
        sections.push(`PATRONES DETECTADOS:\n${grouped['pattern'].map((s) => `• ${s}`).join('\n')}`);
    }
    if (grouped['client_insight']?.length) {
        sections.push(`INSIGHTS DE CLIENTES:\n${grouped['client_insight'].map((s) => `• ${s}`).join('\n')}`);
    }

    return `\n\n--- MEMORIA DEL NEGOCIO ---\n${sections.join('\n\n')}\n--- FIN DE MEMORIA ---`;
}

/**
 * Check if a business has the agentic plan.
 */
export async function isAgenticPlan(businessId: number): Promise<boolean> {
    try {
        const { rows } = await db.query('SELECT plan FROM businesses WHERE id = $1', [businessId]);
        return rows.length > 0 && rows[0].plan === 'agentic';
    } catch {
        return false;
    }
}
