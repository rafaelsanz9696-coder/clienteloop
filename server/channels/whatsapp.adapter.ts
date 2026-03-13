import db from '../db/database.js';
import { AutomationService } from '../lib/automation.js';
import { getIo } from '../lib/socket.js';

/**
 * Send a WhatsApp message directly to a phone number without a conversation.
 * Used for appointment reminders — bypasses DB logging and socket emission.
 */
export async function sendDirectWhatsApp(
  phone: string,
  text: string,
  phoneId: string
): Promise<{ sent: boolean; reason?: string }> {
  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone) return { sent: false, reason: 'Invalid phone number' };

  if (process.env.ENABLE_CHANNELS !== 'true') {
    console.log(`[Reminder] CHANNELS disabled — would send to +${cleanPhone}: "${text.substring(0, 60)}..."`);
    return { sent: true, reason: 'simulated (ENABLE_CHANNELS=false)' };
  }

  const token = process.env.META_ACCESS_TOKEN;
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
  async sendMessage(conversationId: number, text: string) {
    console.log(`[WhatsApp] Sending message to conversation ${conversationId}: ${text}`);

    // Always log it in our database regardless of real/mock
    const { rows } = await db.query(`
      INSERT INTO messages (conversation_id, content, sender, is_ai_generated)
      VALUES ($1, $2, 'agent', 0) RETURNING *
    `, [conversationId, text]);

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
      const token = process.env.META_ACCESS_TOKEN;
      const phoneId = process.env.META_PHONE_ID;

      if (!token || !phoneId) {
        console.warn('[WhatsApp] Meta credentials missing (.env: META_ACCESS_TOKEN, META_PHONE_ID)');
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
          const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: phone.replace(/\D/g, ''), // Ensure clean numeric string
              type: 'text',
              text: { preview_url: false, body: text }
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            console.error(`[WhatsApp API] Error ${response.status}:`, errText);
          } else {
            console.log(`[WhatsApp API] Message dynamically sent to ${phone}`);
          }
        } catch (error) {
          console.error(`[WhatsApp API] Failed to send message:`, error);
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
