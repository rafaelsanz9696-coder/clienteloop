import { Router } from 'express';
import db from '../db/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Plan limits: how many owned businesses each plan allows
const PLAN_LIMITS: Record<string, number> = {
  starter: 1,
  pro: 3,
  agency: Infinity,
};

// GET /api/business  — list all accessible businesses (owned + member)
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const { rows } = await db.query(
      `SELECT b.id, b.name, b.nicho, b.owner_name, b.booking_slug,
              COALESCE(b.plan, 'starter') AS plan,
              CASE WHEN b.supabase_user_id = $1 THEN 'admin' ELSE bm.role END AS my_role
       FROM businesses b
       LEFT JOIN business_members bm
         ON bm.business_id = b.id AND bm.supabase_user_id = $1
       WHERE b.supabase_user_id = $1 OR bm.supabase_user_id = $1
       ORDER BY (b.supabase_user_id = $1)::int DESC, b.id ASC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/business  — create new business (enforces plan limits)
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, nicho = 'salon' } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const userId = req.user?.id;

    // Get the best plan across all businesses this user owns
    const { rows: ownedRows } = await db.query(
      `SELECT COALESCE(plan, 'starter') AS plan FROM businesses WHERE supabase_user_id = $1`,
      [userId]
    );
    const PLAN_RANK: Record<string, number> = { starter: 0, pro: 1, agency: 2 };
    const bestPlan = ownedRows.reduce((best: string, row: { plan: string }) => {
      return (PLAN_RANK[row.plan] ?? 0) > (PLAN_RANK[best] ?? 0) ? row.plan : best;
    }, 'starter');

    const limit = PLAN_LIMITS[bestPlan] ?? 1;
    const currentCount = ownedRows.length;

    if (currentCount >= limit) {
      return res.status(403).json({
        error: 'PLAN_LIMIT_REACHED',
        plan: bestPlan,
        limit,
        current: currentCount,
      });
    }

    const { rows } = await db.query(
      `INSERT INTO businesses (name, nicho, owner_name, supabase_user_id) VALUES ($1, $2, 'Dueño', $3) RETURNING *`,
      [name, nicho, userId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// ─── Channel Numbers (must be before /:id to avoid route shadowing) ────────

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

// ─── Parameterized routes (must come after specific named paths) ────────────

// GET /api/business/:id
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    // Security: only allow fetching the user's own active business
    if (bid !== Number(req.params.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { rows } = await db.query('SELECT * FROM businesses WHERE id = $1', [bid]);
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

export default router;
