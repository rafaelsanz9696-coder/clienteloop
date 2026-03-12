import { Router } from 'express';
import db from '../db/database.js';
import { AutomationService } from '../lib/automation.js';
import { getIo } from '../lib/socket.js';
import crypto from 'crypto';
import fs from 'fs';

const router = Router();

// ─── Webhook signature verification (Infobip HMAC-SHA256) ───────────────────

function verifyInfobipSignature(req: any): boolean {
  const secret = process.env.INFOBIP_WEBHOOK_SECRET;
  if (!secret) return true; // Skip verification if no secret configured (dev mode)

  const signature = req.headers['x-hub-signature'] || req.headers['x-infobip-signature'];
  if (!signature) return false;

  const body = JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── Multi-tenant: resolve business_id from channel number ──────────────────

async function resolveBusinessId(channel: string, identifier: string): Promise<number | null> {
  const { rows } = await db.query(
    'SELECT business_id FROM channel_numbers WHERE channel = $1 AND identifier = $2',
    [channel, identifier],
  );
  return rows.length > 0 ? rows[0].business_id : null;
}

// ─── Shared helper ───────────────────────────────────────────────────────────

async function processIncomingMessage(
  businessId: number,
  phone: string | null,
  email: string | null,
  name: string,
  text: string,
  channel: string,
): Promise<void> {
  let contactId: number;

  if (phone) {
    const { rows: byPhone } = await db.query(
      'SELECT id FROM contacts WHERE phone = $1 AND business_id = $2',
      [phone, businessId],
    );
    if (byPhone.length > 0) {
      contactId = byPhone[0].id;
      await db.query('UPDATE contacts SET last_contact_at = CURRENT_TIMESTAMP WHERE id = $1', [contactId]);
    } else {
      const { rows: newContact } = await db.query(
        'INSERT INTO contacts (business_id, name, phone, channel, pipeline_stage, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [businessId, name, phone, channel, 'new', 'open'],
      );
      contactId = newContact[0].id;
    }
  } else if (email) {
    const { rows: byEmail } = await db.query(
      'SELECT id FROM contacts WHERE email = $1 AND business_id = $2',
      [email, businessId],
    );
    if (byEmail.length > 0) {
      contactId = byEmail[0].id;
      await db.query('UPDATE contacts SET last_contact_at = CURRENT_TIMESTAMP WHERE id = $1', [contactId]);
    } else {
      const { rows: newContact } = await db.query(
        'INSERT INTO contacts (business_id, name, email, channel, pipeline_stage, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [businessId, name, email, channel, 'new', 'open'],
      );
      contactId = newContact[0].id;
    }
  } else {
    console.warn('[Webhook] No phone or email in payload — ignoring.');
    return;
  }

  let conversationId: number;
  const { rows: openConvs } = await db.query(
    "SELECT id FROM conversations WHERE contact_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 1",
    [contactId],
  );

  if (openConvs.length > 0) {
    conversationId = openConvs[0].id;
  } else {
    const { rows: newConv } = await db.query(
      'INSERT INTO conversations (business_id, contact_id, channel) VALUES ($1,$2,$3) RETURNING id',
      [businessId, contactId, channel],
    );
    conversationId = newConv[0].id;
  }

  const { rows: msgRows } = await db.query(
    "INSERT INTO messages (conversation_id, content, sender, is_ai_generated) VALUES ($1,$2,'client',0) RETURNING *",
    [conversationId, text],
  );
  const newMsg = msgRows[0];

  getIo().to(`business_${businessId}`).emit('new_message', {
    conversation_id: conversationId,
    message: newMsg,
  });

  await db.query(
    'UPDATE conversations SET last_message=$1, last_message_at=CURRENT_TIMESTAMP, unread_count=unread_count+1 WHERE id=$2',
    [text, conversationId],
  );

  AutomationService.handleIncomingMessage(conversationId, text);
}

// ─── Respond.io / generic webhook (legacy) ───────────────────────────────────

router.post('/respondio', async (req, res) => {
  try {
    const payload = req.body;
    res.status(200).send('OK');

    const phone = payload.contact?.phone || payload.from || null;
    const text = payload.message?.text || payload.text || null;
    const businessId = Number(payload.business_id) || 1;

    if (!phone || !text) {
      console.warn('[Webhook/respondio] Missing phone or text — ignoring.');
      return;
    }

    const name = payload.contact?.name || phone;
    const channel = payload.channel || 'whatsapp';

    await processIncomingMessage(businessId, phone, null, name, text, channel);
  } catch (err) {
    console.error('[Webhook/respondio Error]', err);
  }
});

// ─── Meta WhatsApp Cloud API — Webhook Verification ────────────────────────────

router.get('/meta/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const myVerifyToken = process.env.META_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === myVerifyToken) {
    console.log('[Meta Webhook] Verified!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ─── Meta WhatsApp Cloud API — Receiving Messages ───────────────────────────

router.post('/meta/whatsapp', async (req, res) => {
  try {
    const body = req.body;
    console.log('[Meta Webhook POST] Payload arriving:', JSON.stringify(body, null, 2));

    if (body.object !== 'whatsapp_business_account') {
      return res.sendStatus(200);
    }

    // Always return 200 immediately to Meta so they don't retry
    res.sendStatus(200);

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.value && change.value.messages && change.value.messages[0]) {
          const message = change.value.messages[0];
          const contact = change.value.contacts[0];
          const phoneId = change.value.metadata.phone_number_id;

          // Resolve business by phoneId from DB
          const businessId = await resolveBusinessId('whatsapp', phoneId);

          if (!businessId) {
            console.warn(`[Meta Webhook] No business mapped for Phone ID ${phoneId} — ignoring.`);
            continue;
          }

          const fromPhone = message.from;
          const text = message.text?.body;
          const name = contact.profile?.name || fromPhone;

          if (!text) {
            console.log('[Meta Webhook] Received non-text message. Ignoring for now.');
            continue;
          }

          await processIncomingMessage(businessId, fromPhone, null, name, text, 'whatsapp');
        }
      }
    }
  } catch (err) {
    console.error('[Meta Webhook Error]', err);
    if (!res.headersSent) res.sendStatus(500);
  }
});

export default router;
