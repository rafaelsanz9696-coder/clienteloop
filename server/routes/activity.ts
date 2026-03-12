import { Router } from 'express';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/activity?contact_id=X
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const contactId = req.query.contact_id as string | undefined;

    let query = `
      SELECT al.id, al.type, al.description, al.created_at, c.name as contact_name
      FROM activity_log al
      LEFT JOIN contacts c ON c.id = al.contact_id
      WHERE al.business_id = $1
    `;
    const params: any[] = [bid];

    if (contactId) {
      params.push(contactId);
      query += ` AND al.contact_id = $${params.length}`;
    }
    query += ' ORDER BY al.created_at DESC LIMIT 50';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
