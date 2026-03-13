import db from '../db/database.js';
import { respondWithNichoAI, extractTaskFromConversation } from './nicho-engine.js';
import { sendChannelMessage } from '../channels/channel-router.js';
import { isAgenticPlan, getMemories, storeMemory, formatMemoriesForPrompt } from './agent-memory.js';
import { buildScheduleContext } from './appointments.js';

/**
 * Strip markdown formatting so AI responses render cleanly in WhatsApp.
 * WhatsApp does NOT render Markdown asterisks — they show as literal characters.
 */
function formatForWhatsApp(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')        // ## Heading → Heading
    .replace(/\*\*(.*?)\*\*/gs, '$1')    // **bold** → bold
    .replace(/__(.*?)__/gs, '$1')        // __bold__ → bold
    .replace(/\*(.*?)\*/gs, '$1')        // *italic* → italic
    .replace(/_(.*?)_/gs, '$1')          // _italic_ → italic
    .replace(/^[-*_]{3,}\s*$/gm, '')     // --- / *** / ___ dividers → remove
    .replace(/^[\-\*]\s+/gm, '• ')      // - item / * item → • item
    .replace(/`([^`]+)`/g, '$1')         // `code` → code
    .replace(/\n{3,}/g, '\n\n')          // collapse 3+ blank lines → 2
    .trim();
}

/** Returns true if the string contains at least one emoji character. */
function containsEmoji(text: string): boolean {
  return /\p{Emoji_Presentation}/u.test(text);
}

export const AutomationService = {
    async handleIncomingMessage(conversationId: number, content: string) {
        if (process.env.ENABLE_AUTO_REPLY !== 'true') return;

        console.log(`[Automation] Processing auto-reply for conversation ${conversationId}...`);

        const { rows: convRows } = await db.query(`
          SELECT c.*, ct.name as contact_name, b.nicho, b.ai_context, b.name as business_name, b.id as business_id
          FROM conversations c
          JOIN contacts ct ON ct.id = c.contact_id
          JOIN businesses b ON b.id = c.business_id
          WHERE c.id = $1
        `, [conversationId]);

        if (convRows.length === 0) return;
        const conv = convRows[0];

        const { rows: messages } = await db.query(
            'SELECT content, sender FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 6',
            [conversationId]
        );

        const rawHistory = [...messages].reverse().map((m: any) => ({
            role: (m.sender === 'client' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content,
        }));

        // Anthropic requires strictly alternating roles (user, assistant, user).
        // If a user sends 2 messages in a row, we must collapse them into 1.
        const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
        for (const msg of rawHistory) {
            const last = history[history.length - 1];
            if (last && last.role === msg.role) {
                last.content += '\n\n' + msg.content;
            } else {
                history.push(msg);
            }
        }

        // ─── Agentic Memory: fetch relevant memories for this business ───────
        let memoriesPrompt: string | undefined;
        const agentic = await isAgenticPlan(conv.business_id);
        if (agentic) {
            // Extract keywords from the incoming message for relevance scoring
            const keywords = content.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const memories = await getMemories(conv.business_id, keywords, 8);
            if (memories.length > 0) {
                memoriesPrompt = formatMemoriesForPrompt(memories);
                console.log(`[Automation] Injecting ${memories.length} memories for business ${conv.business_id}`);
            }
        }

        // ─── Build schedule context for appointment-aware AI ─────────────────
        let scheduleContext: string | undefined;
        const scheduleKeywords = ['cita', 'agendar', 'agenda', 'reserva', 'reservar', 'hora', 'horario', 'disponible', 'appointment'];
        if (scheduleKeywords.some((kw) => content.toLowerCase().includes(kw))) {
            try {
                scheduleContext = await buildScheduleContext(conv.business_id, 3, 60);
            } catch (schedErr) {
                console.error('[Automation] Schedule context build failed (non-fatal):', schedErr);
            }
        }

        try {
            await new Promise(resolve => setTimeout(resolve, 2000));

            const result = await respondWithNichoAI({
                nicho: conv.nicho,
                businessName: conv.business_name,
                negocioContext: conv.ai_context || '',
                conversationHistory: history.slice(0, -1),
                newMessage: content,
                memories: memoriesPrompt,
                clientUsesEmojis: containsEmoji(content), // Mirror client's emoji style
                scheduleContext,
            });

            if (result.response && !result.escalate) {
                console.log(`[Automation] AI decided to respond: ${result.response.substring(0, 30)}...`);

                // Strip markdown before sending to WhatsApp
                const formattedResponse = conv.channel === 'whatsapp'
                    ? formatForWhatsApp(result.response)
                    : result.response;

                await sendChannelMessage(conv.channel, conversationId, formattedResponse);

                await db.query(`
                  UPDATE messages SET is_ai_generated = 1
                  WHERE id = (
                    SELECT id FROM messages
                    WHERE conversation_id = $1 AND sender = 'agent'
                    ORDER BY id DESC LIMIT 1
                  )
                `, [conversationId]);

                // ─── Agentic: Auto-learn FAQs from repeated topics ──────────
                if (agentic) {
                    await AutomationService.learnFromInteraction(
                        conv.business_id, content, result.response
                    );
                }

                // ─── Auto-extract tasks/citas from the conversation ──────────
                // Runs after reply so failures never affect message delivery
                try {
                    const fullHistory = [
                        ...history,
                        { role: 'assistant' as const, content: result.response },
                    ];
                    const extracted = await extractTaskFromConversation({ conversationHistory: fullHistory });
                    if (extracted && extracted.confidence > 0.7) {
                        await db.query(
                            `INSERT INTO tasks (business_id, contact_id, title, due_time, status)
                             VALUES ($1, $2, $3, $4, 'pending')`,
                            [conv.business_id, conv.contact_id, extracted.title, extracted.due_time || null]
                        );
                        console.log(`[Automation] Auto-task created: "${extracted.title}" (confidence: ${extracted.confidence})`);
                    }
                } catch (taskErr) {
                    // Non-fatal — task extraction failure never breaks the auto-reply flow
                    console.error('[Automation] Task extraction failed (non-fatal):', taskErr);
                }

            } else if (result.escalate) {
                console.log(`[Automation] AI decided to ESCALATE.`);
            }
        } catch (err) {
            console.error('[Automation Error]', err);
        }
    },

    // Auto-learn: save the Q&A pair as a FAQ memory if it looks like a price/service question
    async learnFromInteraction(businessId: number, question: string, answer: string) {
        const priceKeywords = ['precio', 'cuesta', 'cuanto', 'cuánto', 'valor', 'cost', 'price', 'tarifa', 'cobran'];
        const serviceKeywords = ['servicio', 'ofrece', 'hacen', 'tratan', 'disponible', 'tienen', 'horario', 'hora'];

        const lower = question.toLowerCase();
        const isPriceQ = priceKeywords.some(k => lower.includes(k));
        const isServiceQ = serviceKeywords.some(k => lower.includes(k));

        if (isPriceQ || isServiceQ) {
            const faqContent = `P: ${question.trim()} | R: ${answer.trim().substring(0, 150)}`;
            await storeMemory(businessId, 'faq', faqContent, 'auto_learned', isPriceQ ? 8 : 6);
        }
    },
};
