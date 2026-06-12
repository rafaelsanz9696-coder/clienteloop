/**
 * baileys.ts — WhatsApp QR (coexistence) channel management.
 *
 * Lets a business link its existing WhatsApp number to ClienteLoop as a
 * "linked device" (like WhatsApp Web). The phone keeps working normally.
 */
import { Router } from 'express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { BaileysAdapter } from '../channels/baileys.adapter.js';

const router = Router();

// POST /api/channels/baileys/connect — start (or resume) a session; QR comes via /status
router.post('/connect', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const status = await BaileysAdapter.connect(businessId);
    res.json(status);
  } catch (err) {
    console.error('[Baileys Route] connect failed:', err);
    res.status(500).json({ error: 'No se pudo iniciar la sesión de WhatsApp' });
  }
});

// GET /api/channels/baileys/status — poll for QR / connection state
router.get('/status', (req: AuthenticatedRequest, res: Response) => {
  res.json(BaileysAdapter.getStatus(req.user!.business_id));
});

// POST /api/channels/baileys/disconnect — log out and clear stored credentials
router.post('/disconnect', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await BaileysAdapter.disconnect(req.user!.business_id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Baileys Route] disconnect failed:', err);
    res.status(500).json({ error: 'No se pudo desconectar la sesión' });
  }
});

export default router;
