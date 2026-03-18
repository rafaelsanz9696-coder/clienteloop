import { Router } from 'express';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/quick-replies?category=saludo
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const category = req.query.category as string;

    let query = 'SELECT * FROM quick_replies WHERE business_id = $1';
    const params: any[] = [bid];

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    query += ' ORDER BY category, title';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// GET /api/quick-replies/:id
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const { rows } = await db.query(
      'SELECT * FROM quick_replies WHERE id = $1 AND business_id = $2',
      [req.params.id, bid],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Quick reply not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/quick-replies
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const business_id = req.user!.business_id;
    const { title, content, category = 'general' } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'title and content are required' });

    const result = await db.query(
      'INSERT INTO quick_replies (business_id, title, content, category) VALUES ($1, $2, $3, $4) RETURNING *',
      [business_id, title, content, category]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PUT /api/quick-replies/:id
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const { title, content, category } = req.body;
    const { rows } = await db.query(
      'UPDATE quick_replies SET title=COALESCE($1,title), content=COALESCE($2,content), category=COALESCE($3,category) WHERE id=$4 AND business_id=$5 RETURNING *',
      [title, content, category, req.params.id, bid]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Quick reply not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// DELETE /api/quick-replies/:id
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    await db.query('DELETE FROM quick_replies WHERE id = $1 AND business_id = $2', [req.params.id, bid]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
