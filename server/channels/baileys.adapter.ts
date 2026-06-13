/**
 * baileys.adapter.ts — Unofficial WhatsApp channel via Baileys (WhatsApp Web protocol).
 *
 * Connects ClienteLoop as a "linked device" of an existing WhatsApp Business
 * account — true coexistence: the phone keeps working normally while the CRM
 * receives and sends messages in parallel.
 *
 * IMPORTANT: This is NOT an official Meta API. Keep usage conversational
 * (replying to inbound messages); avoid mass unsolicited sends — Meta can ban
 * numbers that exhibit spam-like behavior.
 *
 * Session auth state is stored on disk (BAILEYS_AUTH_DIR, default ./baileys_auth).
 * On Railway, mount a persistent volume there or the QR must be re-scanned
 * after each deploy.
 */
import { promises as fs } from 'fs';
import path from 'path';
import pino from 'pino';
import QRCode from 'qrcode';
import * as baileys from '@whiskeysockets/baileys';
import db from '../db/database.js';
import { getIo } from '../lib/socket.js';
import { processIncomingMessage } from '../routes/webhooks.js';

// Interop-safe resolution of makeWASocket (package ships CJS with default export)
const makeWASocket: any =
  (baileys as any).makeWASocket ?? (baileys as any).default?.makeWASocket ?? (baileys as any).default;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys as any;

const AUTH_ROOT = process.env.BAILEYS_AUTH_DIR || path.resolve('baileys_auth');

export type BaileysStatus = 'disconnected' | 'connecting' | 'qr' | 'connected';

interface BaileysSession {
  sock: any;
  status: BaileysStatus;
  qr: string | null;        // data URL for the frontend <img>
  phone: string | null;     // own number once connected
  recentlySent: Set<string>; // message ids we sent — to ignore their fromMe echo
}

const sessions = new Map<number, BaileysSession>();

interface MediaPayload {
  type: string;
  url?: string;
  mime?: string;
  name?: string;
  lat?: number;
  lng?: number;
  locationName?: string;
  buttons?: { id: string; title: string }[];
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function emitStatus(businessId: number) {
  const s = sessions.get(businessId);
  try {
    getIo().to(`business_${businessId}`).emit('baileys_status', {
      status: s?.status ?? 'disconnected',
      phone: s?.phone ?? null,
    });
  } catch {
    // socket.io not initialized yet (boot-time restore) — status endpoint still works
  }
}

/** Unwrap ephemeral / view-once containers and extract displayable text. */
function extractText(message: any): string {
  if (!message) return '';
  const inner =
    message.ephemeralMessage?.message ??
    message.viewOnceMessage?.message ??
    message.viewOnceMessageV2?.message ??
    message;

  if (inner.conversation) return inner.conversation;
  if (inner.extendedTextMessage?.text) return inner.extendedTextMessage.text;
  if (inner.imageMessage) return inner.imageMessage.caption ? `[imagen] — ${inner.imageMessage.caption}` : '[imagen]';
  if (inner.videoMessage) return inner.videoMessage.caption ? `[video] — ${inner.videoMessage.caption}` : '[video]';
  if (inner.audioMessage) return '[audio]';
  if (inner.stickerMessage) return '[sticker]';
  if (inner.documentMessage) return `[documento: ${inner.documentMessage.fileName || 'archivo'}]`;
  if (inner.locationMessage) {
    const name = inner.locationMessage.name || inner.locationMessage.address || '';
    return name ? `[ubicación: ${name}]` : '[ubicación compartida]';
  }
  if (inner.contactMessage) return `[contacto: ${inner.contactMessage.displayName || ''}]`;
  if (inner.buttonsResponseMessage?.selectedDisplayText) return inner.buttonsResponseMessage.selectedDisplayText;
  if (inner.listResponseMessage?.title) return inner.listResponseMessage.title;
  return '';
}

/**
 * A reply sent from the phone app (coexistence) — log it as an agent message so
 * the dashboard reflects the conversation and the AI has full context.
 */
async function recordPhoneReply(businessId: number, phone: string, text: string): Promise<void> {
  const { rows: contacts } = await db.query(
    "SELECT id FROM contacts WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1 AND business_id = $2",
    [phone, businessId],
  );
  if (contacts.length === 0) return; // outbound-first chat with no CRM contact — ignore

  const { rows: convs } = await db.query(
    "SELECT id FROM conversations WHERE contact_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 1",
    [contacts[0].id],
  );
  if (convs.length === 0) return;
  const conversationId = convs[0].id;

  const { rows } = await db.query(
    `INSERT INTO messages (conversation_id, content, sender, is_ai_generated)
     VALUES ($1, $2, 'agent', 0) RETURNING *`,
    [conversationId, text],
  );

  getIo().to(`business_${businessId}`).emit('new_message', {
    conversation_id: conversationId,
    message: rows[0],
  });

  await db.query(
    'UPDATE conversations SET last_message = $1, last_message_at = CURRENT_TIMESTAMP WHERE id = $2',
    [text, conversationId],
  );
}

async function handleUpsert(businessId: number, session: BaileysSession, msg: any): Promise<void> {
  const jid: string = msg.key?.remoteJid ?? '';
  console.log(`[Baileys] upsert jid=${jid} fromMe=${msg.key?.fromMe} hasMsg=${!!msg.message}`);

  if (!jid.endsWith('@s.whatsapp.net')) {
    console.log(`[Baileys] skipped: non-individual jid (${jid})`);
    return; // skip groups, status, newsletters
  }
  if (!msg.message) return;

  const text = extractText(msg.message);
  if (!text) {
    console.log(`[Baileys] skipped: no extractable text — keys: ${Object.keys(msg.message).join(',')}`);
    return;
  }

  const phone = jid.split('@')[0].replace(/\D/g, '');

  if (msg.key.fromMe) {
    // Echo of a message we sent through this adapter — skip
    if (msg.key.id && session.recentlySent.has(msg.key.id)) {
      session.recentlySent.delete(msg.key.id);
      return;
    }
    // Sent manually from the phone app — mirror into the CRM
    await recordPhoneReply(businessId, phone, text);
    return;
  }

  const name = msg.pushName || phone;
  console.log(`[Baileys] ⬇️ incoming from +${phone} (${name}): "${text.slice(0, 40)}" — routing to business ${businessId}`);
  await processIncomingMessage(businessId, phone, null, name, text, 'whatsapp');
}

export const BaileysAdapter = {
  async connect(businessId: number) {
    const existing = sessions.get(businessId);
    if (existing && existing.status !== 'disconnected') {
      return this.getStatus(businessId);
    }

    const dir = path.join(AUTH_ROOT, String(businessId));
    await fs.mkdir(dir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(dir);

    // WhatsApp rejects outdated protocol versions (405) — always fetch current
    let version: [number, number, number] | undefined;
    try {
      ({ version } = await fetchLatestBaileysVersion());
    } catch {
      console.warn('[Baileys] Could not fetch latest WA Web version — using library default');
    }

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }) as any,
      markOnlineOnConnect: false, // keep phone notifications working
      browser: ['ClienteLoop', 'Chrome', '1.0.0'],
      syncFullHistory: false,
    });

    const session: BaileysSession = {
      sock,
      status: 'connecting',
      qr: null,
      phone: null,
      recentlySent: new Set(),
    };
    sessions.set(businessId, session);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          session.qr = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
          session.status = 'qr';
          emitStatus(businessId);
        } catch (err) {
          console.error('[Baileys] QR generation failed:', err);
        }
      }

      if (connection === 'open') {
        session.status = 'connected';
        session.qr = null;
        session.phone = sock.user?.id?.split(':')[0]?.split('@')[0] ?? null;
        console.log(`[Baileys] ✅ Business ${businessId} connected as +${session.phone}`);
        emitStatus(businessId);
      }

      if (connection === 'close') {
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        session.status = 'disconnected';
        session.qr = null;
        emitStatus(businessId);
        sessions.delete(businessId);

        if (code === DisconnectReason.loggedOut) {
          console.log(`[Baileys] Business ${businessId} logged out — clearing auth state`);
          await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
        } else {
          console.log(`[Baileys] Business ${businessId} connection closed (code ${code}) — reconnecting in 3s`);
          setTimeout(() => {
            BaileysAdapter.connect(businessId).catch((err) =>
              console.error('[Baileys] Reconnect failed:', err),
            );
          }, 3000);
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
      console.log(`[Baileys] messages.upsert type=${type} count=${messages?.length ?? 0}`);
      // 'notify' = live message; 'append' can also carry fresh messages right
      // after connecting. Only 'set' (bulk history sync) is safe to ignore.
      if (type === 'set') return;
      for (const msg of messages) {
        try {
          await handleUpsert(businessId, session, msg);
        } catch (err) {
          console.error('[Baileys] Failed to process incoming message:', err);
        }
      }
    });

    return this.getStatus(businessId);
  },

  isConnected(businessId: number): boolean {
    return sessions.get(businessId)?.status === 'connected';
  },

  /** First business with a live session — fallback for senders without business context. */
  getAnyConnectedBusinessId(): number | null {
    for (const [id, s] of sessions) if (s.status === 'connected') return id;
    return null;
  },

  getStatus(businessId: number) {
    const s = sessions.get(businessId);
    return {
      status: (s?.status ?? 'disconnected') as BaileysStatus,
      qr: s?.qr ?? null,
      phone: s?.phone ?? null,
    };
  },

  async disconnect(businessId: number) {
    const s = sessions.get(businessId);
    if (s) {
      try { await s.sock.logout(); } catch { /* already dead */ }
      try { s.sock.end?.(); } catch { /* noop */ }
      sessions.delete(businessId);
    }
    await fs.rm(path.join(AUTH_ROOT, String(businessId)), { recursive: true, force: true }).catch(() => {});
    emitStatus(businessId);
    return { success: true };
  },

  /**
   * Send a message through the linked device. Simulates human typing
   * (presence + length-proportional delay) to stay under spam heuristics.
   */
  async sendMessage(
    businessId: number,
    phone: string,
    text: string,
    media?: MediaPayload,
  ): Promise<{ sent: boolean; reason?: string }> {
    const session = sessions.get(businessId);
    if (!session || session.status !== 'connected') {
      return { sent: false, reason: 'Baileys session not connected' };
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) return { sent: false, reason: 'Invalid phone number' };
    const jid = `${cleanPhone}@s.whatsapp.net`;

    try {
      try {
        await session.sock.presenceSubscribe(jid);
        await session.sock.sendPresenceUpdate('composing', jid);
      } catch { /* presence is best-effort */ }

      await delay(800 + Math.min(text.length * 25, 2500) + Math.random() * 700);

      try { await session.sock.sendPresenceUpdate('paused', jid); } catch { /* noop */ }

      let content: any;
      if (media?.type === 'location' && media.lat != null && media.lng != null) {
        content = {
          location: {
            degreesLatitude: media.lat,
            degreesLongitude: media.lng,
            name: media.locationName || undefined,
          },
        };
      } else if (media?.url) {
        if (media.type === 'image') {
          content = { image: { url: media.url }, caption: text || undefined };
        } else if (media.type === 'video') {
          content = { video: { url: media.url }, caption: text || undefined };
        } else if (media.type === 'audio') {
          content = { audio: { url: media.url }, mimetype: media.mime || 'audio/mpeg' };
        } else if (media.type === 'document') {
          content = {
            document: { url: media.url },
            fileName: media.name || 'documento',
            mimetype: media.mime || 'application/octet-stream',
          };
        } else if (media.type === 'sticker') {
          content = { sticker: { url: media.url } };
        } else {
          content = { text: text ? `${text}\n${media.url}` : media.url };
        }
      } else {
        content = { text };
      }

      const result = await session.sock.sendMessage(jid, content);
      if (result?.key?.id) {
        session.recentlySent.add(result.key.id);
        if (session.recentlySent.size > 300) {
          // trim oldest entries to bound memory
          const it = session.recentlySent.values();
          for (let i = 0; i < 100; i++) session.recentlySent.delete(it.next().value as string);
        }
      }

      console.log(`[Baileys] ✅ Sent to +${cleanPhone} (business ${businessId})`);
      return { sent: true };
    } catch (err) {
      console.error('[Baileys] Send failed:', err);
      return { sent: false, reason: 'Baileys send error' };
    }
  },

  /** Restore previously-linked sessions from disk on server boot. */
  async restoreSessions() {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(AUTH_ROOT);
    } catch {
      return; // no auth dir yet — nothing to restore
    }

    for (const entry of entries) {
      const businessId = Number(entry);
      if (!Number.isInteger(businessId)) continue;
      try {
        await fs.access(path.join(AUTH_ROOT, entry, 'creds.json'));
        console.log(`[Baileys] Restoring session for business ${businessId}...`);
        await this.connect(businessId);
      } catch {
        // folder without creds — skip
      }
    }
  },
};
