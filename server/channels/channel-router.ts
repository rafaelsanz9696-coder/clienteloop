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
  existingMessageId?: number, // if already persisted by caller, skip DB insert in adapter
): Promise<void> {
  if (process.env.ENABLE_CHANNELS !== 'true') {
    return; // Channels disabled via env flag
  }

  switch (channel.toLowerCase()) {
    case 'whatsapp':
      await WhatsAppAdapter.sendMessage(conversationId, text, media, existingMessageId);
      break;

    default:
      console.warn(`[ChannelRouter] Unknown channel "${channel}" — message not delivered externally.`);
  }
}
