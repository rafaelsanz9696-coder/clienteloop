import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/conversations/follow-up — open conversations silent for 24h+ where last msg was from agent
router.get('/follow-up', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const hours = Math.max(1, Math.min(Number(req.query.hours) || 24, 720));

    const { rows } = await db.query(
      `SELECT sub.*, ct.name as contact_name, ct.phone as contact_phone, ct.channel as contact_channel
       FROM (
         SELECT c.*,
           EXTRACT(EPOCH FROM (NOW() - c.last_message_at)) / 3600 AS hours_since_last,
           (SELECT sender FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_sender
         FROM conversations c
         WHERE c.business_id = $1
           AND c.status = 'open'
           AND c.last_message_at < NOW() - ($2 || ' hours')::INTERVAL
       ) sub
       JOIN contacts ct ON ct.id = sub.contact_id
       WHERE sub.last_sender = 'agent'
       ORDER BY sub.last_message_at ASC
       LIMIT 50`,
      [bid, hours]
    );
    res.json(rows);
  } catch (err) {
    console.error('[follow-up]', err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// GET /api/conversations/unread-count — total unread messages across all conversations
router.get('/unread-count', async (req: AuthenticatedRequest, res) => {
  try {
    const { rows } = await db.query(
      `SELECT COALESCE(SUM(unread_count), 0)::int AS count
       FROM conversations WHERE business_id = $1`,
      [req.user!.business_id]
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// GET /api/conversations?status=open
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const status = req.query.status as string;
    const contactId = req.query.contact_id as string;

    let query = `
      SELECT c.*, ct.name as contact_name, ct.phone as contact_phone, ct.channel as contact_channel
      FROM conversations c
      JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.business_id = $1
    `;
    const params: any[] = [bid];

    if (status) {
      params.push(status);
      query += ` AND c.status = $${params.length}`;
    }
    if (contactId) {
      params.push(contactId);
      query += ` AND c.contact_id = $${params.length}`;
    }
    query += ' ORDER BY c.last_message_at DESC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// GET /api/conversations/:id
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const { rows } = await db.query(`
      SELECT c.*, ct.name as contact_name, ct.phone as contact_phone,
             ct.channel as contact_channel, ct.pipeline_stage, ct.notes as contact_notes
      FROM conversations c
      JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.id = $1 AND c.business_id = $2
    `, [req.params.id, bid]);

    if (rows.length === 0) return res.status(404).json({ error: 'Conversation not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/conversations
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const business_id = req.user!.business_id;
    const { contact_id, channel = 'whatsapp' } = req.body;
    if (!contact_id) return res.status(400).json({ error: 'contact_id is required' });

    const { rows } = await db.query(`
      INSERT INTO conversations (business_id, contact_id, channel)
      VALUES ($1, $2, $3) RETURNING *
    `, [business_id, contact_id, channel]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PATCH /api/conversations/:id/status
router.patch('/:id/status', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const { status } = req.body;
    await db.query('UPDATE conversations SET status=$1 WHERE id=$2 AND business_id=$3', [status, req.params.id, bid]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PATCH /api/conversations/:id/read
router.patch('/:id/read', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    await db.query('UPDATE conversations SET unread_count=0 WHERE id=$1 AND business_id=$2', [req.params.id, bid]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PATCH /api/conversations/:id/assign
router.patch('/:id/assign', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const { assigned_to } = req.body;
    await db.query('UPDATE conversations SET assigned_to=$1 WHERE id=$2 AND business_id=$3', [assigned_to, req.params.id, bid]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PATCH /api/conversations/:id/intent — set intent label manually
router.patch('/:id/intent', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const { intent_label } = req.body;
    const label = typeof intent_label === 'string' ? intent_label.trim().slice(0, 100) : null;
    await db.query('UPDATE conversations SET intent_label=$1 WHERE id=$2 AND business_id=$3', [label || null, req.params.id, bid]);
    res.json({ success: true, intent_label: label || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/conversations/:id/detect-intent — auto-detect via AI
router.post('/:id/detect-intent', async (req: AuthenticatedRequest, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    // Load conversation + first 8 messages + business nicho
    const bid = req.user!.business_id;
    const { rows: convRows } = await db.query(
      `SELECT c.id, ct.name as contact_name, b.nicho, b.name as business_name
       FROM conversations c
       JOIN contacts ct ON ct.id = c.contact_id
       JOIN businesses b ON b.id = c.business_id
       WHERE c.id = $1 AND c.business_id = $2`,
      [req.params.id, bid]
    );
    if (convRows.length === 0) return res.status(404).json({ error: 'Conversation not found' });

    const { rows: msgRows } = await db.query(
      `SELECT sender, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 8`,
      [req.params.id]
    );

    if (msgRows.length === 0) {
      return res.json({ intent_label: null, message: 'No messages to analyze' });
    }

    const conv = convRows[0];
    const transcript = msgRows
      .map((m: any) => `${m.sender === 'client' ? 'Cliente' : 'Negocio'}: ${m.content}`)
      .join('\n');

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 30,
      temperature: 0,
      system: `Eres un clasificador de intenciones de clientes para el negocio "${conv.business_name}" (${conv.nicho || 'general'}).
Analiza los primeros mensajes de la conversación e identifica en 2-4 palabras qué busca el cliente.
Responde ÚNICAMENTE con la etiqueta, sin explicación ni puntuación. Ejemplos de formato:
Compra Shein, Envío local, Envío internacional, Personal shopper, Consulta precio, Reserva cita, Problema entrega, Información general`,
      messages: [{ role: 'user', content: `Conversación:\n${transcript}` }],
    });

    const raw = (response.content.find((c) => c.type === 'text') as any)?.text?.trim() || '';
    const intent_label = raw.slice(0, 100) || null;

    // Persist it
    if (intent_label) {
      await db.query('UPDATE conversations SET intent_label=$1 WHERE id=$2', [intent_label, req.params.id]);
    }

    res.json({ intent_label });
  } catch (err: any) {
    console.error('[detect-intent]', err);
    res.status(500).json({ error: err.message || 'Detection failed' });
  }
});

export default router;
