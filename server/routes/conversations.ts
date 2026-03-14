import { Router } from 'express';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

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
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.*, ct.name as contact_name, ct.phone as contact_phone,
             ct.channel as contact_channel, ct.pipeline_stage, ct.notes as contact_notes
      FROM conversations c
      JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.id = $1
    `, [req.params.id]);

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
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await db.query('UPDATE conversations SET status=$1 WHERE id=$2', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PATCH /api/conversations/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    await db.query('UPDATE conversations SET unread_count=0 WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PATCH /api/conversations/:id/assign
router.patch('/:id/assign', async (req, res) => {
  try {
    const { assigned_to } = req.body;
    await db.query('UPDATE conversations SET assigned_to=$1 WHERE id=$2', [assigned_to, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
