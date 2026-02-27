import db from '../db/database.js';
import { AutomationService } from '../lib/automation.js';
import { getIo } from '../lib/socket.js';

export const InstagramAdapter = {
  async sendMessage(conversationId: number, text: string) {
    console.log(`[Instagram Mock] Sending DM to conversation ${conversationId}: ${text}`);

    const { rows } = await db.query(`
      INSERT INTO messages (conversation_id, content, sender, is_ai_generated)
      VALUES ($1, $2, 'agent', 0) RETURNING *
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
      SET last_message = $1, last_message_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [text, conversationId]);

    return { success: true, messageId: newMsg.id };
  },

  async receiveMessage(conversationId: number, text: string) {
    console.log(`[Instagram Mock] Received DM for conversation ${conversationId}: ${text}`);

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
