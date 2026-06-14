import dotenv from 'dotenv';
dotenv.config();
import db from './server/db/database.js';

async function check() {
    try {
        const channels = await db.query('SELECT * FROM channel_numbers');
        console.log('CHANNELS:', JSON.stringify(channels.rows, null, 2));

        const convs = await db.query('SELECT * FROM conversations WHERE business_id = 8');
        console.log('CONVERSATIONS (business 8):', JSON.stringify(convs.rows, null, 2));

        const { rows } = await db.query('SELECT m.*, c.channel FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.business_id = 8 ORDER BY m.created_at DESC LIMIT 10');
        console.log('LATEST MESSAGES FOR BUSINESS 8:', JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        process.exit(0);
    }
}
check();
