import { Router } from 'express';
import { randomBytes } from 'crypto';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Member limits per plan tier
const PLAN_LIMITS: Record<string, number> = {
  starter:    2,    // owner + 1 agent
  pro:        5,    // owner + 4 agents
  business:   15,   // owner + 14 agents
  enterprise: 999,
};

// ─── Helper: verify user is admin on active business ─────────────────────────
function requireAdmin(req: AuthenticatedRequest, res: any): boolean {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Solo los admins pueden realizar esta acción.' });
    return false;
  }
  return true;
}

// ─── GET /api/team ────────────────────────────────────────────────────────────
// Returns owner info + members list + plan limits
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;

    const { rows: [biz] } = await db.query(
      `SELECT supabase_user_id AS uid, owner_name AS name, email, plan
       FROM businesses WHERE id = $1`,
      [bid]
    );
    if (!biz) return res.status(404).json({ error: 'Negocio no encontrado.' });

    const { rows: members } = await db.query(
      `SELECT * FROM business_members WHERE business_id = $1 ORDER BY joined_at ASC`,
      [bid]
    );

    const limit = PLAN_LIMITS[biz.plan ?? 'starter'] ?? 2;
    const totalCount = 1 + members.length; // owner counts as 1

    res.json({
      owner: { supabase_user_id: biz.uid, name: biz.name, email: biz.email, role: 'admin' },
      members,
      limit,
      total: totalCount,
      plan: biz.plan ?? 'starter',
      my_role: req.user!.role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// ─── GET /api/team/invitations ────────────────────────────────────────────────
router.get('/invitations', async (req: AuthenticatedRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { rows } = await db.query(
      `SELECT * FROM business_invitations
       WHERE business_id = $1 AND accepted_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [req.user!.business_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// ─── GET /api/team/join/:token (preview — returns business name, no join yet) ─
router.get('/join/:token', async (req: AuthenticatedRequest, res) => {
  try {
    const { rows: [invite] } = await db.query(
      `SELECT bi.role, bi.expires_at, b.id AS business_id, b.name AS business_name, b.nicho
       FROM business_invitations bi
       JOIN businesses b ON b.id = bi.business_id
       WHERE bi.token = $1 AND bi.accepted_at IS NULL AND bi.expires_at > NOW()`,
      [req.params.token]
    );
    if (!invite) return res.status(404).json({ error: 'Invitación inválida o expirada.' });

    res.json({
      business_id: invite.business_id,
      business_name: invite.business_name,
      business_nicho: invite.nicho,
      role: invite.role,
      expires_at: invite.expires_at,
    });
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// ─── POST /api/team/invite ────────────────────────────────────────────────────
// Create invite token (admin only). Returns token + full invite link.
router.post('/invite', async (req: AuthenticatedRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const bid = req.user!.business_id;
    const { email, role = 'agent' } = req.body;

    if (!['admin', 'agent'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido. Usa "admin" o "agent".' });
    }

    // Check plan limit before issuing invite
    const { rows: [biz] } = await db.query('SELECT plan FROM businesses WHERE id = $1', [bid]);
    const { rows: memberRows } = await db.query(
      'SELECT COUNT(*) FROM business_members WHERE business_id = $1',
      [bid]
    );
    const limit = PLAN_LIMITS[biz?.plan ?? 'starter'] ?? 2;
    const currentTotal = 1 + parseInt(memberRows[0].count); // +1 for owner

    if (currentTotal >= limit) {
      return res.status(403).json({
        error: `Límite del plan alcanzado (${limit} miembro${limit > 1 ? 's' : ''}). Actualiza tu plan para agregar más colaboradores.`,
        limit,
        current: currentTotal,
      });
    }

    // Generate secure random token, valid 7 days
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO business_invitations (business_id, email, role, token, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [bid, email?.trim() || null, role, token, req.user!.id, expiresAt]
    );

    // Build the invite link (join param in settings page)
    const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:4000';
    const link = `${frontendUrl}/app/settings?join=${token}`;

    res.status(201).json({ token, link, expires_at: expiresAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// ─── POST /api/team/join ──────────────────────────────────────────────────────
// Accept an invitation token (authenticated user, any business_id is OK here)
router.post('/join', async (req: AuthenticatedRequest, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token requerido.' });

    const { rows: [invite] } = await db.query(
      `SELECT * FROM business_invitations
       WHERE token = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
      [token]
    );
    if (!invite) return res.status(404).json({ error: 'Invitación inválida o expirada.' });

    const { rows: [biz] } = await db.query(
      'SELECT supabase_user_id, name, plan FROM businesses WHERE id = $1',
      [invite.business_id]
    );

    // Prevent joining own business
    if (biz.supabase_user_id === req.user!.id) {
      return res.status(409).json({ error: 'Ya eres el dueño de este negocio.' });
    }

    // Prevent duplicate membership
    const { rows: existing } = await db.query(
      'SELECT id FROM business_members WHERE business_id = $1 AND supabase_user_id = $2',
      [invite.business_id, req.user!.id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Ya eres miembro de este negocio.' });
    }

    // Check plan limit (in case owner reduced plan since invite was created)
    const { rows: memberCount } = await db.query(
      'SELECT COUNT(*) FROM business_members WHERE business_id = $1',
      [invite.business_id]
    );
    const limit = PLAN_LIMITS[biz.plan ?? 'starter'] ?? 2;
    if (1 + parseInt(memberCount[0].count) >= limit) {
      return res.status(403).json({ error: 'El negocio ha alcanzado su límite de miembros.' });
    }

    // Add to business_members
    await db.query(
      `INSERT INTO business_members (business_id, supabase_user_id, email, role, invited_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [invite.business_id, req.user!.id, req.user!.email || invite.email || '', invite.role, invite.invited_by]
    );

    // Mark invitation as accepted
    await db.query(
      `UPDATE business_invitations SET accepted_at = NOW(), accepted_by = $1 WHERE id = $2`,
      [req.user!.id, invite.id]
    );

    res.json({
      success: true,
      business_id: invite.business_id,
      business_name: biz.name,
      role: invite.role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// ─── DELETE /api/team/invitations/:id ─────────────────────────────────────────
router.delete('/invitations/:id', async (req: AuthenticatedRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    await db.query(
      'DELETE FROM business_invitations WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user!.business_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// ─── PATCH /api/team/:memberId/role ──────────────────────────────────────────
router.patch('/:memberId/role', async (req: AuthenticatedRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { role } = req.body;
    if (!['admin', 'agent'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido.' });
    }
    const { rows } = await db.query(
      `UPDATE business_members SET role = $1
       WHERE id = $2 AND business_id = $3 RETURNING *`,
      [role, req.params.memberId, req.user!.business_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Miembro no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// ─── DELETE /api/team/:memberId ───────────────────────────────────────────────
router.delete('/:memberId', async (req: AuthenticatedRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    // Prevent self-removal
    const { rows: [member] } = await db.query(
      'SELECT supabase_user_id FROM business_members WHERE id = $1 AND business_id = $2',
      [req.params.memberId, req.user!.business_id]
    );
    if (!member) return res.status(404).json({ error: 'Miembro no encontrado.' });
    if (member.supabase_user_id === req.user!.id) {
      return res.status(400).json({ error: 'No puedes removerte a ti mismo.' });
    }

    await db.query(
      'DELETE FROM business_members WHERE id = $1 AND business_id = $2',
      [req.params.memberId, req.user!.business_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
