import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import db from '../db/database.js';
import { respondWithNichoAI } from '../lib/nicho-engine.js';

const router = Router();

// POST /api/ai/suggest
router.post('/suggest', async (req, res) => {
  try {
    const { conversation_id, tone } = req.body;
    if (!conversation_id) return res.status(400).json({ error: 'conversation_id required' });

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({
        suggestion: '',
        escalate: false,
        error: 'ANTHROPIC_API_KEY not configured. Add it to your .env file.',
      });
    }

    const { rows: convRows } = await db.query(`
      SELECT c.*, ct.name as contact_name, b.nicho, b.ai_context, b.name as business_name
      FROM conversations c
      JOIN contacts ct ON c.contact_id = ct.id
      JOIN businesses b ON c.business_id = b.id
      WHERE c.id = $1
    `, [conversation_id]);

    if (convRows.length === 0) return res.status(404).json({ error: 'Conversation not found' });
    const conv = convRows[0];

    const { rows: messages } = await db.query(
      'SELECT content, sender FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10',
      [conversation_id]
    );

    const history = messages.reverse().map((m: any) => ({
      role: (m.sender === 'client' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    }));

    const lastClientMessage = messages.filter((m: any) => m.sender === 'client').pop()?.content || '';

    if (!lastClientMessage) {
      return res.json({ suggestion: '', escalate: false });
    }

    const startTime = Date.now();
    const result = await respondWithNichoAI({
      nicho: conv.nicho,
      businessName: conv.business_name,
      negocioContext: conv.ai_context || '',
      conversationHistory: history.slice(0, -1),
      newMessage: lastClientMessage,
      tone: tone as any,
    });
    const latencyMs = Date.now() - startTime;

    await db.query(`
      INSERT INTO ai_logs (business_id, conversation_id, nicho, input_tokens, output_tokens, latency_ms, escalated)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      conv.business_id,
      conversation_id,
      conv.nicho,
      result.inputTokens || 0,
      result.outputTokens || 0,
      latencyMs,
      result.escalate ? 1 : 0
    ]);

    res.json({
      suggestion: result.response || '',
      escalate: result.escalate,
    });
  } catch (err: any) {
    console.error('[AI Error]', err);
    res.status(500).json({ error: 'AI suggestion failed', message: err.message });
  }
});

// GET /api/ai/status
router.get('/status', (_req, res) => {
  const configured = !!process.env.ANTHROPIC_API_KEY;
  res.json({
    status: configured ? 'ready' : 'not_configured',
    model: 'claude-sonnet-4-6',
  });
});

// GET /api/ai/logs
router.get('/logs', async (req: any, res) => {
  try {
    const bid = req.user!.business_id;
    const { rows } = await db.query(`
      SELECT * FROM ai_logs 
      WHERE business_id = $1 
      ORDER BY created_at DESC 
      LIMIT 20
    `, [bid]);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch AI logs', message: err.message });
  }
});

// POST /api/ai/extract-task
router.post('/extract-task', async (req, res) => {
  try {
    const { conversation_id } = req.body;
    if (!conversation_id) return res.status(400).json({ error: 'conversation_id required' });

    const { rows: messages } = await db.query(
      'SELECT content, sender FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10',
      [conversation_id]
    );

    const history = messages.reverse().map((m: any) => ({
      role: (m.sender === 'client' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    }));

    const { extractTaskFromConversation } = await import('../lib/nicho-engine.js');
    const task = await extractTaskFromConversation({ conversationHistory: history });

    res.json(task);
  } catch (err: any) {
    console.error('[Extract Task Error]', err);
    res.status(500).json({ error: 'Failed to extract task', message: err.message });
  }
});

// POST /api/ai/analyze-chats
// Analyzes a pasted/uploaded WhatsApp chat export and returns a style profile
router.post('/analyze-chats', async (req, res) => {
  try {
    const { chatText, businessName, nicho } = req.body;

    if (!chatText || typeof chatText !== 'string' || chatText.trim().length < 50) {
      return res.status(400).json({ error: 'chatText must be at least 50 characters' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({
        error: 'ANTHROPIC_API_KEY not configured',
        message: 'Agrega tu clave ANTHROPIC_API_KEY al archivo .env para usar esta función.',
      });
    }

    // Trim to 15,000 chars to stay well within token budget
    const trimmedChat = chatText.trim().slice(0, 15000);

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const analysisPrompt = `Analiza estas conversaciones reales de un negocio llamado "${businessName || 'el negocio'}" (${nicho || 'negocio general'}).

Extrae y genera un perfil de estilo en español con estas 5 secciones exactas:

1. TONO: (describe en 1-2 líneas cómo se comunica el negocio — formal/informal, cercano/distante, etc.)

2. CARACTERÍSTICAS: (usa emojis? respuestas cortas o largas? tutea o trata de usted? responde rápido?)

3. FRASES TÍPICAS: (lista de 5-8 frases o expresiones que el negocio usa frecuentemente)

4. RESPUESTAS COMUNES: (top 8-10 pares en formato "Pregunta del cliente → Respuesta típica del negocio")

5. LO QUE NUNCA DICE: (patrones, palabras o respuestas que claramente evita)

Conversaciones reales:
${trimmedChat}

Responde SOLO con el perfil formateado usando las 5 secciones indicadas. Sin explicaciones extras ni texto adicional antes o después.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      temperature: 0.3,
      messages: [{ role: 'user', content: analysisPrompt }],
    });

    const styleProfile =
      (message.content.find((c) => c.type === 'text') as any)?.text ?? '';

    res.json({
      styleProfile,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    });
  } catch (err: any) {
    console.error('[Analyze Chats Error]', err);
    res.status(500).json({ error: 'Failed to analyze chats', message: err.message });
  }
});

export default router;
