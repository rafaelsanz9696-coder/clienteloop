import db from '../db/database.js';
import { AutomationService } from '../lib/automation.js';
import { getIo } from '../lib/socket.js';
import { enqueueRetry } from '../lib/wa-retry.js';

/**
 * Send a WhatsApp message directly to a phone number without a conversation.
 * Used for appointment reminders — bypasses DB logging and socket emission.
 */
export async function sendDirectWhatsApp(
  phone: string,
  text: string,
  phoneId: string,
  accessToken?: string,  // per-business token from channel_numbers; falls back to env var
): Promise<{ sent: boolean; reason?: string }> {
  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone) return { sent: false, reason: 'Invalid phone number' };

  if (process.env.ENABLE_CHANNELS !== 'true') {
    console.log(`[Reminder] CHANNELS disabled — would send to +${cleanPhone}: "${text.substring(0, 60)}..."`);
    return { sent: true, reason: 'simulated (ENABLE_CHANNELS=false)' };
  }

  const token = accessToken ?? process.env.META_ACCESS_TOKEN;
  if (!token || !phoneId) {
    console.warn('[Reminder] Meta credentials missing — skipping send');
    return { sent: false, reason: 'Missing META credentials' };
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { preview_url: false, body: text },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Reminder] Meta API error ${response.status}:`, errText);
      return { sent: false, reason: `Meta API ${response.status}` };
    }

    console.log(`[Reminder] ✅ Sent to +${cleanPhone}`);
    return { sent: true };
  } catch (err) {
    console.error('[Reminder] Fetch failed:', err);
    return { sent: false, reason: 'Network error' };
  }
}

export const WhatsAppAdapter = {
  async sendMessage(
    conversationId: number,
    text: string,
    media?: { type: string; url: string; mime?: string; name?: string },
  ) {
    console.log(`[WhatsApp] Sending message to conversation ${conversationId}: ${text}`);

    // Always log it in our database regardless of real/mock
    const { rows } = await db.query(`
      INSERT INTO messages
        (conversation_id, content, sender, is_ai_generated, media_type, media_url, media_mime, media_name)
      VALUES ($1, $2, 'agent', 0, $3, $4, $5, $6) RETURNING *
    `, [conversationId, text, media?.type ?? null, media?.url ?? null, media?.mime ?? null, media?.name ?? null]);

    const newMsg = rows[0];

    // Emit to socket room
    const { rows: bRows } = await db.query('SELECT business_id FROM conversations WHERE id = $1', [conversationId]);
    if (bRows.length > 0) {
      getIo().to(`business_${bRows[0].business_id}`).emit('new_message', {
        conversation_id: conversationId,
        message: newMsg
      });
    }

    await db.query(`
      UPDATE conversations
      SET last_message = $1, last_message_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [text, conversationId]);

    // If real channels are enabled, send via Meta API
    if (process.env.ENABLE_CHANNELS === 'true') {
      // Look up per-business token from channel_numbers; fall back to global env vars
      const { rows: chRows } = await db.query(
        `SELECT identifier, access_token FROM channel_numbers
         WHERE business_id = $1 AND channel = 'whatsapp' LIMIT 1`,
        [bRows[0]?.business_id]
      );
      const token   = chRows[0]?.access_token   ?? process.env.META_ACCESS_TOKEN;
      const phoneId = chRows[0]?.identifier     ?? process.env.META_PHONE_ID;

      if (!token || !phoneId) {
        console.warn('[WhatsApp] Meta credentials missing (no channel_numbers row and no env vars)');
        return { success: true, messageId: newMsg.id };
      }

      const { rows: cRows } = await db.query(`
        SELECT ct.phone 
        FROM conversations c 
        JOIN contacts ct ON c.contact_id = ct.id 
        WHERE c.id = $1
      `, [conversationId]);

      const phone = cRows[0]?.phone;

      if (phone) {
        try {
          // Build Meta payload — media or text
          let metaPayload: Record<string, unknown>;
          const cleanTo = phone.replace(/\D/g, '');
          if (media?.url) {
            if (media.type === 'image') {
              metaPayload = {
                messaging_product: 'whatsapp', recipient_type: 'individual', to: cleanTo,
                type: 'image', image: { link: media.url },
              };
            } else if (media.type === 'document') {
              metaPayload = {
                messaging_product: 'whatsapp', recipient_type: 'individual', to: cleanTo,
                type: 'document', document: { link: media.url, filename: media.name || 'documento' },
              };
            } else {
              // Fallback for other media types: send as text with link
              metaPayload = {
                messaging_product: 'whatsapp', recipient_type: 'individual', to: cleanTo,
                type: 'text', text: { preview_url: true, body: `${text}\n${media.url}` },
              };
            }
          } else {
            metaPayload = {
              messaging_product: 'whatsapp', recipient_type: 'individual', to: cleanTo,
              type: 'text', text: { preview_url: false, body: text },
            };
          }

          const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(metaPayload),
          });

          if (!response.ok) {
            const errText = await response.text();
            console.error(`[WhatsApp API] Error ${response.status}:`, errText);
            await enqueueRetry(bRows[0]?.business_id ?? null, conversationId, phone, text, newMsg.id);
          } else {
            console.log(`[WhatsApp API] Message dynamically sent to ${phone}`);
          }
        } catch (error) {
          console.error(`[WhatsApp API] Failed to send message:`, error);
          await enqueueRetry(bRows[0]?.business_id ?? null, conversationId, phone, text, newMsg.id);
        }
      } else {
        console.warn(`[WhatsApp API] No phone number found for conversation ${conversationId}`);
      }
    }

    return { success: true, messageId: newMsg.id };
  },

  async receiveMessage(conversationId: number, text: string) {
    console.log(`[WhatsApp] Received message for conversation ${conversationId}: ${text}`);

    const { rows } = await db.query(`
      INSERT INTO messages (conversation_id, content, sender, is_ai_generated)
      VALUES ($1, $2, 'client', 0) RETURNING *
    `, [conversationId, text]);

    const newMsg = rows[0];

    const { rows: bRows } = await db.query('SELECT business_id FROM conversations WHERE id = $1', [conversationId]);
    if (bRows.length > 0) {
      getIo().to(`business_${bRows[0].business_id}`).emit('new_message', {
        conversation_id: conversationId,
        message: newMsg
      });
    }

    await db.query(`
      UPDATE conversations
      SET last_message = $1, last_message_at = CURRENT_TIMESTAMP, unread_count = unread_count + 1
      WHERE id = $2
    `, [text, conversationId]);

    AutomationService.handleIncomingMessage(conversationId, text);

    return { success: true, messageId: newMsg.id };
  }
};
