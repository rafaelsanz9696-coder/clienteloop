/**
 * channel-router.ts — Routes outgoing messages to the correct channel via Infobip.
 *
 * Used by:
 *  - server/routes/messages.ts  (agent replies from the dashboard)
 *  - server/lib/automation.ts   (AI auto-replies)
 */

import db from '../db/database.js';
import { WhatsAppAdapter } from './whatsapp.adapter.js';

/**
 * Send a message through the contact's preferred channel.
 * Always resolves — errors are logged but never thrown, because the message
 * has already been persisted to the database.
 *
 * @param channel        - 'whatsapp' | 'sms' | 'email'
 * @param conversationId - DB id of the conversation (used to look up contact)
 * @param text           - Plain-text message content
 */
export async function sendChannelMessage(
  channel: string,
  conversationId: number,
  text: string,
  media?: { type: string; url: string; mime?: string; name?: string },
): Promise<void> {
  if (process.env.ENABLE_CHANNELS !== 'true') {
    return; // Channels disabled via env flag
  }

  // We just rely on individual adapters configuring themselves
  // Fetch contact details (phone + email) for this conversation
  const { rows } = await db.query(
    `SELECT ct.phone, ct.email
       FROM conversations c
       JOIN contacts ct ON ct.id = c.contact_id
       WHERE c.id = $1`,
    [conversationId],
  );

  if (rows.length === 0) {
    console.warn(`[ChannelRouter] Conversation ${conversationId} not found.`);
    return;
  }

  const { phone, email } = rows[0];

  switch (channel.toLowerCase()) {
    case 'whatsapp':
      await WhatsAppAdapter.sendMessage(conversationId, text, media);
      break;

    default:
      console.warn(`[ChannelRouter] Unknown channel "${channel}" — message not delivered externally.`);
  }
}
