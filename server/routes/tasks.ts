import { Router } from 'express';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { logActivity } from '../lib/activity.js';

const router = Router();

// GET /api/tasks?status=pending&contact_id=X
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const status = req.query.status as string;
    const contactId = req.query.contact_id as string;

    let query = `
      SELECT t.*, c.name as contact_name
      FROM tasks t
      LEFT JOIN contacts c ON c.id = t.contact_id
      WHERE t.business_id = $1
    `;
    const params: any[] = [bid];

    if (status) {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }
    if (contactId) {
      params.push(contactId);
      query += ` AND t.contact_id = $${params.length}`;
    }
    query += ' ORDER BY t.created_at DESC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/tasks
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const business_id = req.user!.business_id;
    const { contact_id, title, due_time } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const result = await db.query(`
      INSERT INTO tasks (business_id, contact_id, title, due_time)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [business_id, contact_id || null, title, due_time || null]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PATCH /api/tasks/:id/done
router.patch('/:id/done', async (_req: AuthenticatedRequest, res) => {
  try {
    const bid = _req.user!.business_id;
    const { rows } = await db.query(
      "UPDATE tasks SET status='done' WHERE id=$1 AND business_id=$2 RETURNING *",
      [_req.params.id, bid],
    );
    const task = rows[0];
    if (task) {
      logActivity(task.business_id, task.contact_id, 'task_completed', `Tarea "${task.title}" completada`);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    await db.query('DELETE FROM tasks WHERE id=$1 AND business_id=$2', [req.params.id, bid]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
