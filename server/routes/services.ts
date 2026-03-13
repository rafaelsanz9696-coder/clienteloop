import { Router } from 'express';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/services
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM services WHERE business_id = $1 ORDER BY name ASC',
      [req.user!.business_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/services
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const { name, duration_minutes = 60, price } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows } = await db.query(
      `INSERT INTO services (business_id, name, duration_minutes, price)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [bid, name, duration_minutes, price || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PUT /api/services/:id
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, duration_minutes, price, active } = req.body;
    const { rows } = await db.query(
      `UPDATE services
       SET name=COALESCE($1,name),
           duration_minutes=COALESCE($2,duration_minutes),
           price=COALESCE($3,price),
           active=COALESCE($4,active)
       WHERE id=$5 AND business_id=$6 RETURNING *`,
      [name, duration_minutes, price, active, req.params.id, req.user!.business_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// DELETE /api/services/:id
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    await db.query(
      'DELETE FROM services WHERE id=$1 AND business_id=$2',
      [req.params.id, req.user!.business_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
