import { Router } from 'express';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/search?q=query
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const q = ((req.query.q as string) || '').trim();

    if (!q || q.length < 2) {
      return res.json({ contacts: [], conversations: [], deals: [] });
    }

    const like = `%${q}%`;

    const [contactsResult, conversationsResult, dealsResult] = await Promise.all([
      db.query(
        `SELECT id, name, phone, email, channel, pipeline_stage
         FROM contacts
         WHERE business_id = $1 AND (name ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2)
         ORDER BY last_contact_at DESC LIMIT 5`,
        [bid, like],
      ),
      db.query(
        `SELECT cv.id, cv.last_message, cv.last_message_at, cv.channel, c.name as contact_name
         FROM conversations cv
         JOIN contacts c ON c.id = cv.contact_id
         WHERE cv.business_id = $1 AND (cv.last_message ILIKE $2 OR c.name ILIKE $2)
         ORDER BY cv.last_message_at DESC LIMIT 5`,
        [bid, like],
      ),
      db.query(
        `SELECT pd.id, pd.title, pd.stage, pd.value, c.name as contact_name
         FROM pipeline_deals pd
         JOIN contacts c ON c.id = pd.contact_id
         WHERE pd.business_id = $1 AND (pd.title ILIKE $2 OR c.name ILIKE $2)
         ORDER BY pd.created_at DESC LIMIT 5`,
        [bid, like],
      ),
    ]);

    res.json({
      contacts: contactsResult.rows,
      conversations: conversationsResult.rows,
      deals: dealsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
