import { Router } from 'express';
import db from '../db/database.js';
import { AutomationService } from '../lib/automation.js';
import { getIo } from '../lib/socket.js';
import { downloadAndStoreMetaMedia } from '../lib/meta-media.js';
import crypto from 'crypto';

interface MediaPayload {
  type: 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'location';
  url?: string;
  mime?: string;
  name?: string;
  caption?: string;
  lat?: number;
  lng?: number;
  locationName?: string;
}

const router = Router();

// ─── Webhook signature verification (Infobip HMAC-SHA256) ───────────────────

function verifyInfobipSignature(req: any): boolean {
  const secret = process.env.INFOBIP_WEBHOOK_SECRET;
  if (!secret) return false; // Require secret — fail closed, not open

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
  media?: MediaPayload,
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
    `INSERT INTO messages
       (conversation_id, content, sender, is_ai_generated,
        media_type, media_url, media_mime, media_name, media_caption,
        location_lat, location_lng, location_name)
     VALUES ($1,$2,'client',0,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      conversationId, text,
      media?.type ?? null,
      media?.url ?? null,
      media?.mime ?? null,
      media?.name ?? null,
      media?.caption ?? null,
      media?.lat ?? null,
      media?.lng ?? null,
      media?.locationName ?? null,
    ],
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
    const body = req.body; // already parsed by global express.json()
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

          const businessId = await resolveBusinessId('whatsapp', phoneId);
          if (!businessId) {
            console.warn(`[Meta Webhook] No business mapped for Phone ID ${phoneId} — ignoring.`);
            continue;
          }

          const fromPhone = message.from;
          const name = contact.profile?.name || fromPhone;
          const msgType: string = message.type;

          let text = '';
          let media: MediaPayload | undefined;

          if (msgType === 'text') {
            text = message.text?.body || '';
            if (!text) continue; // empty text — skip

          } else if (msgType === 'location') {
            const loc = message.location;
            const locName: string = loc.name || loc.address || '';
            text = locName ? `[ubicación: ${locName}]` : '[ubicación compartida]';
            media = {
              type: 'location',
              lat: loc.latitude,
              lng: loc.longitude,
              locationName: locName || undefined,
            };

          } else if (['image', 'document', 'audio', 'video', 'sticker'].includes(msgType)) {
            const mediaData = (message as any)[msgType];
            const mediaId: string = mediaData.id;
            const mimeType: string = mediaData.mime_type || '';
            const filename: string | undefined = mediaData.filename;
            const caption: string | undefined = mediaData.caption;

            // Human-readable fallback for content column
            const labels: Record<string, string> = {
              image: '[imagen]', audio: '[audio]', video: '[video]', sticker: '[sticker]',
            };
            text = msgType === 'document' && filename
              ? `[documento: ${filename}]`
              : (labels[msgType] ?? `[${msgType}]`);
            if (caption) text += ` — ${caption}`;

            try {
              const publicUrl = await downloadAndStoreMetaMedia(mediaId, mimeType, filename);
              media = {
                type: msgType as MediaPayload['type'],
                url: publicUrl,
                mime: mimeType,
                name: filename,
                caption,
              };
            } catch (err) {
              console.error(`[Meta Webhook] Media download failed for ${mediaId}:`, err);
              text = `[${msgType} — no disponible]`;
              // media stays undefined — stored as text-only fallback
            }

          } else {
            console.log(`[Meta Webhook] Unsupported message type "${msgType}" — skipping.`);
            continue;
          }

          await processIncomingMessage(businessId, fromPhone, null, name, text, 'whatsapp', media);
        }
      }
    }
  } catch (err) {
    console.error('[Meta Webhook Error]', err);
    if (!res.headersSent) res.sendStatus(500);
  }
});

export default router;
