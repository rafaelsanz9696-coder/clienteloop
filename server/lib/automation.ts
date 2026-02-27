import db from '../db/database.js';
import { respondWithNichoAI } from './nicho-engine.js';
import { sendChannelMessage } from '../channels/channel-router.js';

export const AutomationService = {
    async handleIncomingMessage(conversationId: number, content: string) {
        if (process.env.ENABLE_AUTO_REPLY !== 'true') return;

        console.log(`[Automation] Processing auto-reply for conversation ${conversationId}...`);

        const { rows: convRows } = await db.query(`
          SELECT c.*, ct.name as contact_name, b.nicho, b.ai_context, b.name as business_name
          FROM conversations c
          JOIN contacts ct ON ct.id = c.contact_id
          JOIN businesses b ON b.id = c.business_id
          WHERE c.id = $1
        `, [conversationId]);

        if (convRows.length === 0) return;
        const conv = convRows[0];

        const { rows: messages } = await db.query(
            'SELECT content, sender FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 6',
            [conversationId]
        );

        const rawHistory = [...messages].reverse().map((m: any) => ({
            role: (m.sender === 'client' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content,
        }));

        // Anthropic requires strictly alternating roles (user, assistant, user).
        // If a user sends 2 messages in a row, we must collapse them into 1.
        const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
        for (const msg of rawHistory) {
            const last = history[history.length - 1];
            if (last && last.role === msg.role) {
                last.content += '\n\n' + msg.content;
            } else {
                history.push(msg);
            }
        }

        try {
            await new Promise(resolve => setTimeout(resolve, 2000));

            const result = await respondWithNichoAI({
                nicho: conv.nicho,
                businessName: conv.business_name,
                negocioContext: conv.ai_context || '',
                conversationHistory: history.slice(0, -1),
                newMessage: content,
            });

            if (result.response && !result.escalate) {
                console.log(`[Automation] AI decided to respond: ${result.response.substring(0, 30)}...`);

                await sendChannelMessage(conv.channel, conversationId, result.response);

                await db.query(`
                  UPDATE messages SET is_ai_generated = 1 
                  WHERE id = (
                    SELECT id FROM messages 
                    WHERE conversation_id = $1 AND sender = 'agent' 
                    ORDER BY id DESC LIMIT 1
                  )
                `, [conversationId]);
            } else if (result.escalate) {
                console.log(`[Automation] AI decided to ESCALATE.`);
            }
        } catch (err) {
            console.error('[Automation Error]', err);
        }
    }
};
