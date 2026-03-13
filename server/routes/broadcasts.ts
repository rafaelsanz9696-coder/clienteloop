import { Router } from 'express';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { executeBroadcast } from '../lib/broadcast-sender.js';

const router = Router();

// ─── GET /api/broadcasts ──────────────────────────────────────────────────────
// List broadcasts for active business
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM broadcasts
       WHERE business_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user!.business_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// ─── GET /api/broadcasts/:id ──────────────────────────────────────────────────
// Get broadcast detail with recipient summary
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;

    const { rows: b } = await db.query(
      'SELECT * FROM broadcasts WHERE id = $1 AND business_id = $2',
      [req.params.id, bid]
    );
    if (b.length === 0) return res.status(404).json({ error: 'Not found' });

    const { rows: recipients } = await db.query(
      `SELECT br.*, c.name AS contact_name
       FROM broadcast_recipients br
       LEFT JOIN contacts c ON c.id = br.contact_id
       WHERE br.broadcast_id = $1
       ORDER BY br.id ASC`,
      [req.params.id]
    );

    res.json({ ...b[0], recipients });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// ─── POST /api/broadcasts ─────────────────────────────────────────────────────
// Create broadcast + enqueue recipients
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const { name, message, filter } = req.body;
    // filter: { type: 'all' | 'stage' | 'tag', value?: string }

    if (!name?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'name and message are required' });
    }

    // Build contact query based on filter
    let contactQuery = `
      SELECT id, name, phone FROM contacts
      WHERE business_id = $1 AND phone IS NOT NULL AND phone != ''
    `;
    const params: any[] = [bid];

    if (filter?.type === 'stage' && filter.value) {
      params.push(filter.value);
      contactQuery += ` AND pipeline_stage = $${params.length}`;
    } else if (filter?.type === 'tag' && filter.value) {
      params.push(`%"${filter.value}"%`);
      contactQuery += ` AND tags LIKE $${params.length}`;
    }

    const { rows: contacts } = await db.query(contactQuery, params);

    if (contacts.length === 0) {
      return res.status(400).json({ error: 'No hay contactos con teléfono en ese filtro.' });
    }

    // Create broadcast record
    const { rows: b } = await db.query(
      `INSERT INTO broadcasts (business_id, name, message, status, recipient_count)
       VALUES ($1, $2, $3, 'draft', $4) RETURNING *`,
      [bid, name.trim(), message.trim(), contacts.length]
    );
    const broadcastId = b[0].id;

    // Insert recipients
    for (const c of contacts) {
      const cleanPhone = c.phone.replace(/\D/g, '');
      if (!cleanPhone) continue;
      await db.query(
        `INSERT INTO broadcast_recipients (broadcast_id, contact_id, phone, name)
         VALUES ($1, $2, $3, $4)`,
        [broadcastId, c.id, cleanPhone, c.name]
      );
    }

    res.status(201).json(b[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// ─── POST /api/broadcasts/:id/send ───────────────────────────────────────────
// Trigger actual send (runs in background, returns immediately)
router.post('/:id/send', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;

    const { rows } = await db.query(
      'SELECT * FROM broadcasts WHERE id = $1 AND business_id = $2',
      [req.params.id, bid]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const broadcast = rows[0];
    if (broadcast.status === 'sending') {
      return res.status(409).json({ error: 'Ya está siendo enviado.' });
    }
    if (broadcast.status === 'completed') {
      return res.status(409).json({ error: 'Ya fue enviado.' });
    }

    // Fire and forget — runs in background
    executeBroadcast(Number(req.params.id)).catch((err) =>
      console.error(`[Broadcast #${req.params.id}] Background error:`, err)
    );

    res.json({ started: true, broadcast_id: broadcast.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// ─── DELETE /api/broadcasts/:id ──────────────────────────────────────────────
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    await db.query(
      `DELETE FROM broadcasts WHERE id = $1 AND business_id = $2 AND status != 'sending'`,
      [req.params.id, req.user!.business_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// ─── GET /api/broadcasts/preview ─────────────────────────────────────────────
// Count recipients for a given filter (used before creating broadcast)
router.get('/preview/count', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const type  = req.query.type  as string;
    const value = req.query.value as string;

    let q = `SELECT COUNT(*) FROM contacts WHERE business_id = $1 AND phone IS NOT NULL AND phone != ''`;
    const params: any[] = [bid];

    if (type === 'stage' && value) {
      params.push(value);
      q += ` AND pipeline_stage = $${params.length}`;
    } else if (type === 'tag' && value) {
      params.push(`%"${value}"%`);
      q += ` AND tags LIKE $${params.length}`;
    }

    const { rows } = await db.query(q, params);
    res.json({ count: parseInt(rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
