import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET /api/ai/insights — generate real-time insights from conversations and patterns
router.get('/insights', async (req: AuthenticatedRequest, res) => {
    try {
        const bid = req.user!.business_id;

        // Pull recent conversations (last 72h) with their latest message
        const { rows: conversations } = await db.query(`
      SELECT c.id, c.status, c.unread_count, c.last_message, c.last_message_at,
             ct.name as contact_name, ct.channel, ct.pipeline_stage
      FROM conversations c
      JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.business_id = $1 AND c.last_message_at > NOW() - INTERVAL '72 hours'
      ORDER BY c.last_message_at DESC
      LIMIT 30
    `, [bid]);

        // Pull last 5 days of pipeline activity
        const { rows: deals } = await db.query(`
      SELECT pd.title, pd.stage, pd.value, ct.name as contact_name
      FROM pipeline_deals pd
      JOIN contacts ct ON ct.id = pd.contact_id
      WHERE pd.business_id = $1 AND pd.created_at > NOW() - INTERVAL '5 days'
      ORDER BY pd.created_at DESC
      LIMIT 10
    `, [bid]);

        // Pull business context
        const { rows: bizRows } = await db.query(
            'SELECT name, nicho, ai_context, working_hours FROM businesses WHERE id = $1',
            [bid]
        );
        const biz = bizRows[0] || {};

        // Pull existing memories
        const { rows: memories } = await db.query(
            `SELECT type, content FROM business_memories WHERE business_id=$1 ORDER BY relevance DESC LIMIT 10`,
            [bid]
        );

        // Build prompt
        const systemPrompt = `Eres un analista de ventas y CRM para ${biz.name || 'este negocio'} (industria: ${biz.nicho || 'general'}).
Tu trabajo es observar los datos del negocio y generar insights concisos y accionables en español.
Sé directo, práctico y específico. Máximo 4 insights. Cada insight debe tener: título corto, descripción, y acción recomendada.
Responde SOLO con JSON válido en este formato:
{
  "insights": [
    {
      "type": "opportunity" | "alert" | "pattern" | "suggestion",
      "title": "Título corto",
      "description": "Qué detecté",
      "action": "Qué hacer ahora",
      "priority": "high" | "medium" | "low"
    }
  ],
  "summary": "Una frase sobre el estado general del negocio hoy"
}`;

        const userMessage = `Datos actuales del negocio:

CONVERSACIONES RECIENTES (72h):
${conversations.length === 0 ? 'Sin conversaciones recientes' :
                conversations.map(c =>
                    `- ${c.contact_name} (${c.channel}): "${c.last_message?.slice(0, 80)}" [Estado: ${c.status}, Pipeline: ${c.pipeline_stage}]`
                ).join('\n')
            }

DEALS RECIENTES (5 días):
${deals.length === 0 ? 'Sin deals recientes' :
                deals.map(d => `- ${d.contact_name}: ${d.title} (${d.stage}, $${d.value})`).join('\n')
            }

MEMORIAS DE LA IA:
${memories.length === 0 ? 'Sin memorias' :
                memories.map(m => `- [${m.type}] ${m.content}`).join('\n')
            }

Genera insights útiles basados en estos datos.`;

        const message = await anthropic.messages.create({
            model: 'claude-3-5-haiku-20241022', // faster/cheaper for insights
            max_tokens: 800,
            messages: [{ role: 'user', content: userMessage }],
            system: systemPrompt,
        });

        const content = (message.content[0] as any).text;
        const parsed = JSON.parse(content);
        res.json(parsed);
    } catch (err: any) {
        console.error('[AI Insights]', err);
        // Fallback: return generic insights if AI fails
        res.json({
            insights: [],
            summary: 'No hay suficientes datos para generar insights aún.',
            error: true,
        });
    }
});

export default router;
