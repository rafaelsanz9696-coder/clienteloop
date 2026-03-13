import { Router } from 'express';
import db from '../db/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/business  — list all businesses
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const fallbackId = req.user?.business_id;

    const { rows } = await db.query('SELECT id, name, nicho, owner_name FROM businesses WHERE supabase_user_id = $1 OR id = $2 ORDER BY id ASC', [userId, fallbackId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/business  — create new business
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, nicho = 'salon' } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { rows } = await db.query(
      `INSERT INTO businesses (name, nicho, owner_name, supabase_user_id) VALUES ($1, $2, 'Dueño', $3) RETURNING *`,
      [name, nicho, req.user?.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// GET /api/business/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM businesses WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Business not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// PUT /api/business/:id
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, nicho, owner_name, email, phone, working_hours, ai_context } = req.body;
    const { rows } = await db.query(`
      UPDATE businesses SET name=$1, nicho=$2, owner_name=$3, email=$4, phone=$5, working_hours=$6, ai_context=$7
      WHERE id=$8 AND (supabase_user_id=$9 OR id=$10) RETURNING *
    `, [name, nicho, owner_name, email, phone, working_hours, ai_context, req.params.id, req.user?.id, req.user?.business_id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// ─── Channel Numbers ───────────────────────────────────────────────────────

// GET /api/business/channels
router.get('/channels', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { rows } = await db.query(
      'SELECT * FROM channel_numbers WHERE business_id = $1 ORDER BY created_at DESC',
      [businessId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/business/channels
router.post('/channels', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { channel, identifier, label = '' } = req.body;
    if (!channel || !identifier) {
      return res.status(400).json({ error: 'channel and identifier are required' });
    }
    const { rows } = await db.query(
      `INSERT INTO channel_numbers (business_id, channel, identifier, label)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (channel, identifier) DO UPDATE SET business_id = $1, label = $4
       RETURNING *`,
      [businessId, channel, identifier.trim(), label],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// DELETE /api/business/channels/:id
router.delete('/channels/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    await db.query(
      'DELETE FROM channel_numbers WHERE id = $1 AND business_id = $2',
      [req.params.id, businessId],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// PATCH /api/business/booking-slug — update booking slug for active business
router.patch('/booking-slug', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { booking_slug } = req.body;

    // Validate: lowercase alphanumeric + hyphens only, 3-50 chars
    const slug = (booking_slug ?? '').toString().toLowerCase().trim();
    if (slug && !/^[a-z0-9-]{3,50}$/.test(slug)) {
      return res.status(400).json({ error: 'Slug inválido. Solo letras, números y guiones (3-50 caracteres).' });
    }

    // Check uniqueness
    if (slug) {
      const { rows } = await db.query(
        'SELECT id FROM businesses WHERE booking_slug = $1 AND id != $2',
        [slug, businessId]
      );
      if (rows.length > 0) {
        return res.status(409).json({ error: 'Ese slug ya está en uso. Elige otro.' });
      }
    }

    await db.query(
      'UPDATE businesses SET booking_slug = $1 WHERE id = $2',
      [slug || null, businessId]
    );
    res.json({ success: true, booking_slug: slug || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
