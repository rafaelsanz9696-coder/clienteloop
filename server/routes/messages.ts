import { Router } from 'express';
import db from '../db/database.js';
import { getIo } from '../lib/socket.js';
import { sendChannelMessage } from '../channels/channel-router.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/messages?conversation_id=1
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const convId = req.query.conversation_id;
    if (!convId) return res.status(400).json({ error: 'conversation_id is required' });

    // Security: verify conversation belongs to this business before returning messages
    const { rows: convCheck } = await db.query(
      'SELECT id FROM conversations WHERE id = $1 AND business_id = $2',
      [convId, bid],
    );
    if (convCheck.length === 0) return res.status(404).json({ error: 'Conversation not found' });

    const { rows: messages } = await db.query(`
      SELECT * FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
    `, [convId]);

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/messages  — send a message
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const { conversation_id, content, sender = 'agent', is_ai_generated = false } = req.body;
    if (!conversation_id || !content) {
      return res.status(400).json({ error: 'conversation_id and content are required' });
    }

    // Security: verify conversation belongs to this business before inserting
    const { rows: convCheck } = await db.query(
      'SELECT id FROM conversations WHERE id = $1 AND business_id = $2',
      [conversation_id, bid],
    );
    if (convCheck.length === 0) return res.status(404).json({ error: 'Conversation not found' });

    const { rows: newMsg } = await db.query(`
      INSERT INTO messages (conversation_id, content, sender, is_ai_generated)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [conversation_id, content, sender, is_ai_generated ? 1 : 0]);

    // Update conversation last message
    await db.query(`
      UPDATE conversations
      SET last_message = $1, last_message_at = CURRENT_TIMESTAMP,
          unread_count = CASE WHEN $2 = 'client' THEN unread_count + 1 ELSE unread_count END
      WHERE id = $3
    `, [content, sender, conversation_id]);

    // Update contact last_contact_at
    await db.query(`
      UPDATE contacts SET last_contact_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT contact_id FROM conversations WHERE id = $1)
    `, [conversation_id]);

    getIo().to(`business_${bid}`).emit('new_message', {
      conversation_id: conversation_id,
      message: newMsg[0]
    });

    res.status(201).json(newMsg[0]);

    // Fire-and-forget: deliver via external channel (WhatsApp/SMS/Email)
    // Only for agent/AI messages — client messages arrive FROM the channel, not to it.
    if (sender !== 'client') {
      const { rows: convRows } = await db.query(
        'SELECT channel FROM conversations WHERE id = $1',
        [conversation_id],
      );
      if (convRows.length > 0) {
        sendChannelMessage(convRows[0].channel, Number(conversation_id), content);
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
