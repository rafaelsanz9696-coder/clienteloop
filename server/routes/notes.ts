import { Router } from 'express';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { logActivity } from '../lib/activity.js';

const router = Router();

// GET /api/notes?contact_id=X
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { contact_id } = req.query;
    if (!contact_id) return res.status(400).json({ error: 'contact_id is required' });

    const { rows } = await db.query(
      'SELECT * FROM contact_notes WHERE contact_id = $1 ORDER BY created_at DESC',
      [contact_id],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/notes
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { contact_id, content } = req.body;
    if (!contact_id || !content?.trim()) {
      return res.status(400).json({ error: 'contact_id and content are required' });
    }

    const { rows } = await db.query(
      'INSERT INTO contact_notes (business_id, contact_id, content) VALUES ($1, $2, $3) RETURNING *',
      [businessId, contact_id, content.trim()],
    );

    // Log activity (fire-and-forget)
    const contactRow = await db.query('SELECT name FROM contacts WHERE id = $1', [contact_id]);
    const contactName = contactRow.rows[0]?.name ?? 'contacto';
    logActivity(businessId, Number(contact_id), 'note_added', `Nota agregada a ${contactName}`);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', async (_req, res) => {
  try {
    await db.query('DELETE FROM contact_notes WHERE id = $1', [_req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
