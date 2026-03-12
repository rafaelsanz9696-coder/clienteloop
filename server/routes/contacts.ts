import { Router } from 'express';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { logActivity } from '../lib/activity.js';

const router = Router();

// GET /api/contacts?stage=new&search=maria&tag=VIP
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const stage = req.query.stage as string;
    const search = req.query.search as string;
    const tag = req.query.tag as string;

    let query = 'SELECT * FROM contacts WHERE business_id = $1';
    const params: any[] = [bid];

    if (stage) {
      params.push(stage);
      query += ` AND pipeline_stage = $${params.length}`;
    }
    if (search) {
      const like = `%${search}%`;
      query += ` AND (name ILIKE $${params.length + 1} OR phone ILIKE $${params.length + 2} OR email ILIKE $${params.length + 3})`;
      params.push(like, like, like);
    }
    if (tag) {
      // Filter contacts whose JSON tags array contains the tag value
      params.push(JSON.stringify([tag]));
      query += ` AND (tags::jsonb @> $${params.length}::jsonb)`;
    }
    query += ' ORDER BY last_contact_at DESC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// GET /api/contacts/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM contacts WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Contact not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/contacts
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const business_id = req.user!.business_id;
    const { name, phone, email, channel = 'whatsapp', pipeline_stage = 'new', notes = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows } = await db.query(`
      INSERT INTO contacts (business_id, name, phone, email, channel, pipeline_stage, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [business_id, name, phone || null, email || null, channel, pipeline_stage, notes]);

    logActivity(business_id, rows[0].id, 'contact_created', `Contacto ${name} creado`);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PUT /api/contacts/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, email, channel, pipeline_stage, status, notes, tags } = req.body;
    const { rows } = await db.query(`
      UPDATE contacts
      SET name=COALESCE($1,name), phone=COALESCE($2,phone), email=COALESCE($3,email),
          channel=COALESCE($4,channel), pipeline_stage=COALESCE($5,pipeline_stage),
          status=COALESCE($6,status), notes=COALESCE($7,notes), tags=COALESCE($8,tags),
          last_contact_at=CURRENT_TIMESTAMP
      WHERE id=$9 RETURNING *
    `, [name, phone, email, channel, pipeline_stage, status, notes, tags, req.params.id]);

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PATCH /api/contacts/:id/stage
router.patch('/:id/stage', async (req, res) => {
  try {
    const { stage } = req.body;
    await db.query('UPDATE contacts SET pipeline_stage=$1, last_contact_at=CURRENT_TIMESTAMP WHERE id=$2', [stage, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM contacts WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
