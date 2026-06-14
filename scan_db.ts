import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres.futudjapwrhkhpdokjyk:SjfkmuZu6mdBiyci@aws-0-us-west-2.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    console.log('=== CHANNEL NUMBERS ===');
    const channels = await pool.query('SELECT * FROM channel_numbers');
    console.log(channels.rows);

    console.log('\n=== LATEST CONVERSATIONS ===');
    const convs = await pool.query(`
      SELECT c.id, c.business_id, c.contact_id, c.channel, c.status, c.last_message, c.last_message_at, ct.name as contact_name, ct.phone as contact_phone
      FROM conversations c
      JOIN contacts ct ON c.contact_id = ct.id
      ORDER BY c.last_message_at DESC NULLS LAST LIMIT 5
    `);
    console.log(convs.rows);

    console.log('\n=== LATEST MESSAGES ===');
    const msgs = await pool.query(`
      SELECT m.id, m.conversation_id, m.content, m.sender, m.created_at, m.is_ai_generated
      FROM messages m
      ORDER BY m.created_at DESC LIMIT 10
    `);
    console.log(msgs.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
