import { Router } from 'express';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { logActivity } from '../lib/activity.js';

const router = Router();

const STAGE_LABELS: Record<string, string> = {
  new: 'Nuevos',
  in_progress: 'En Proceso',
  closed: 'Cerrado',
};

// GET /api/pipeline?contact_id=X  → flat array for contact profile
// GET /api/pipeline               → grouped { new, in_progress, closed }
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const contactId = req.query.contact_id as string;

    if (contactId) {
      const { rows } = await db.query(
        `SELECT pd.*, c.name as contact_name, c.phone as contact_phone, c.channel
         FROM pipeline_deals pd
         JOIN contacts c ON c.id = pd.contact_id
         WHERE pd.business_id = $1 AND pd.contact_id = $2
         ORDER BY pd.created_at DESC`,
        [bid, contactId],
      );
      return res.json(rows);
    }

    const { rows: deals } = await db.query(
      `SELECT pd.*, c.name as contact_name, c.phone as contact_phone, c.channel
       FROM pipeline_deals pd
       JOIN contacts c ON c.id = pd.contact_id
       WHERE pd.business_id = $1
       ORDER BY pd.created_at DESC`,
      [bid],
    );

    res.json({
      new: deals.filter((d: any) => d.stage === 'new'),
      in_progress: deals.filter((d: any) => d.stage === 'in_progress'),
      closed: deals.filter((d: any) => d.stage === 'closed'),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/pipeline
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const business_id = req.user!.business_id;
    const { contact_id, title, stage = 'new', value = 0, notes = '' } = req.body;
    if (!contact_id || !title) return res.status(400).json({ error: 'contact_id and title are required' });

    const { rows } = await db.query(
      `INSERT INTO pipeline_deals (business_id, contact_id, title, stage, value, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [business_id, contact_id, title, stage, value, notes],
    );

    const contactRow = await db.query('SELECT name FROM contacts WHERE id = $1', [contact_id]);
    const contactName = contactRow.rows[0]?.name ?? 'contacto';
    logActivity(business_id, Number(contact_id), 'deal_created', `Deal "${title}" creado para ${contactName}`);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PATCH /api/pipeline/:id/stage
router.patch('/:id/stage', async (req: AuthenticatedRequest, res) => {
  try {
    const { stage } = req.body;
    if (!['new', 'in_progress', 'closed'].includes(stage)) {
      return res.status(400).json({ error: 'Invalid stage' });
    }

    const bid = req.user!.business_id;
    await db.query('UPDATE pipeline_deals SET stage=$1 WHERE id=$2 AND business_id=$3', [stage, req.params.id, bid]);

    const { rows } = await db.query(
      'SELECT pd.*, c.name as contact_name FROM pipeline_deals pd JOIN contacts c ON c.id = pd.contact_id WHERE pd.id=$1',
      [req.params.id],
    );
    if (rows.length > 0) {
      await db.query('UPDATE contacts SET pipeline_stage=$1 WHERE id=$2', [stage, rows[0].contact_id]);
      logActivity(bid, rows[0].contact_id, 'deal_stage_changed',
        `Deal "${rows[0].title}" movido a ${STAGE_LABELS[stage] ?? stage}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PUT /api/pipeline/:id
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const { title, stage, value, notes } = req.body;
    const { rows } = await db.query(
      `UPDATE pipeline_deals SET title=COALESCE($1,title), stage=COALESCE($2,stage),
       value=COALESCE($3,value), notes=COALESCE($4,notes) WHERE id=$5 AND business_id=$6 RETURNING *`,
      [title, stage, value, notes, req.params.id, bid],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Deal not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// DELETE /api/pipeline/:id
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    await db.query('DELETE FROM pipeline_deals WHERE id=$1 AND business_id=$2', [req.params.id, bid]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
