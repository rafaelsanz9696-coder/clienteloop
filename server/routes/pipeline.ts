import { Router } from 'express';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/pipeline
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;

    const { rows: deals } = await db.query(`
      SELECT pd.*, c.name as contact_name, c.phone as contact_phone, c.channel
      FROM pipeline_deals pd
      JOIN contacts c ON c.id = pd.contact_id
      WHERE pd.business_id = $1
      ORDER BY pd.created_at DESC
    `, [bid]);

    // Group by stage
    const grouped = {
      new: deals.filter((d: any) => d.stage === 'new'),
      in_progress: deals.filter((d: any) => d.stage === 'in_progress'),
      closed: deals.filter((d: any) => d.stage === 'closed'),
    };

    res.json(grouped);
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

    const { rows } = await db.query(`
      INSERT INTO pipeline_deals (business_id, contact_id, title, stage, value, notes)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [business_id, contact_id, title, stage, value, notes]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PATCH /api/pipeline/:id/stage
router.patch('/:id/stage', async (req, res) => {
  try {
    const { stage } = req.body;
    const validStages = ['new', 'in_progress', 'closed'];
    if (!validStages.includes(stage)) {
      return res.status(400).json({ error: 'Invalid stage' });
    }

    await db.query('UPDATE pipeline_deals SET stage=$1 WHERE id=$2', [stage, req.params.id]);

    // Sync contact pipeline_stage
    const { rows } = await db.query('SELECT contact_id FROM pipeline_deals WHERE id=$1', [req.params.id]);
    if (rows.length > 0) {
      await db.query('UPDATE contacts SET pipeline_stage=$1 WHERE id=$2', [stage, rows[0].contact_id]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PUT /api/pipeline/:id
router.put('/:id', async (req, res) => {
  try {
    const { title, stage, value, notes } = req.body;
    const { rows } = await db.query(`
      UPDATE pipeline_deals SET title=COALESCE($1,title), stage=COALESCE($2,stage),
      value=COALESCE($3,value), notes=COALESCE($4,notes) WHERE id=$5 RETURNING *
    `, [title, stage, value, notes, req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// DELETE /api/pipeline/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM pipeline_deals WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
