import dotenv from 'dotenv';
dotenv.config();
import db from './server/db/database.js';

async function run() {
  try {
    console.log('--- ALL MESSAGES FOR CONVERSATION 7 ---');
    const msgs = await db.query(`
      SELECT * FROM messages 
      WHERE conversation_id = 7 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    console.log(JSON.stringify(msgs.rows, null, 2));

    console.log('--- CONVERSATION 7 STATE ---');
    const convs = await db.query(`
      SELECT * FROM conversations WHERE id = 7
    `);
    console.log(JSON.stringify(convs.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
