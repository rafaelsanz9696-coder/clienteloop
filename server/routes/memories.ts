import { Router } from 'express';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/memories — list all memories for the authenticated business
router.get('/', async (req: AuthenticatedRequest, res) => {
    try {
        const bid = req.user!.business_id;
        const { rows } = await db.query(
            `SELECT * FROM business_memories
       WHERE business_id = $1
       ORDER BY relevance DESC, created_at DESC`,
            [bid],
        );
        res.json(rows);
    } catch (err) {
        console.error('[Memories GET]', err);
        res.status(500).json({ error: 'DB Error' });
    }
});

// POST /api/memories — create a new memory
router.post('/', async (req: AuthenticatedRequest, res) => {
    try {
        const bid = req.user!.business_id;
        const { type, content, relevance = 5, source = 'manual' } = req.body;

        if (!type || !content) {
            return res.status(400).json({ error: 'type and content are required' });
        }

        const validTypes = ['style', 'faq', 'pattern', 'client_insight'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
        }

        const { rows } = await db.query(
            `INSERT INTO business_memories (business_id, type, content, source, relevance)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [bid, type, content.trim(), source, Math.min(10, Math.max(1, Number(relevance)))],
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[Memories POST]', err);
        res.status(500).json({ error: 'DB Error' });
    }
});

// PATCH /api/memories/:id — update relevance or content
router.patch('/:id', async (req: AuthenticatedRequest, res) => {
    try {
        const bid = req.user!.business_id;
        const { content, relevance } = req.body;

        const { rows } = await db.query(
            `UPDATE business_memories
       SET content   = COALESCE($1, content),
           relevance = COALESCE($2, relevance),
           updated_at = NOW()
       WHERE id = $3 AND business_id = $4
       RETURNING *`,
            [content ?? null, relevance != null ? Number(relevance) : null, req.params.id, bid],
        );

        if (rows.length === 0) return res.status(404).json({ error: 'Memory not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error('[Memories PATCH]', err);
        res.status(500).json({ error: 'DB Error' });
    }
});

// DELETE /api/memories/:id — remove a memory
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
    try {
        const bid = req.user!.business_id;
        await db.query(
            'DELETE FROM business_memories WHERE id = $1 AND business_id = $2',
            [req.params.id, bid],
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[Memories DELETE]', err);
        res.status(500).json({ error: 'DB Error' });
    }
});

export default router;
