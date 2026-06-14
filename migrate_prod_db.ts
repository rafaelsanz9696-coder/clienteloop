import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres.futudjapwrhkhpdokjyk:SjfkmuZu6mdBiyci@aws-0-us-west-2.pooler.supabase.com:6543/postgres'
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('--- STARTING PROD DATABASE MIGRATION & UNIFICATION ---');
    await client.query('BEGIN');

    // 1. Update the channel mapping to point to the active Business ID 8
    console.log('1. Updating channel_numbers to map to business_id 8...');
    const channelUpdate = await client.query(`
      UPDATE channel_numbers 
      SET business_id = 8 
      WHERE identifier = '1000177549846403' AND channel = 'whatsapp'
      RETURNING *
    `);
    console.log('Updated channel row:', channelUpdate.rows);

    // 2. Move messages from conversation 6 (business 6) to conversation 7 (business 8)
    console.log('2. Migrating messages from conversation 6 to 7...');
    const messageMigration = await client.query(`
      UPDATE messages 
      SET conversation_id = 7 
      WHERE conversation_id = 6
      RETURNING id
    `);
    console.log(`Migrated ${messageMigration.rowCount} messages.`);

    // 3. Update the active conversation 7 metadata with the latest message and timestamp
    console.log('3. Updating active conversation 7 metadata...');
    const convUpdate = await client.query(`
      UPDATE conversations 
      SET last_message = 'Cómo vas', 
          last_message_at = '2026-05-22T04:54:49.978Z'::timestamp, 
          unread_count = 2 
      WHERE id = 7
      RETURNING *
    `);
    console.log('Updated conversation row:', convUpdate.rows);

    // 4. Optionally: delete/deprecate conversation 6 and contact 5 to avoid confusion
    console.log('4. Cleaning up old duplicate conversation 6 and contact 5...');
    await client.query(`DELETE FROM conversations WHERE id = 6`);
    await client.query(`DELETE FROM contacts WHERE id = 5`);
    console.log('Cleanup completed successfully.');

    await client.query('COMMIT');
    console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('--- ERROR DURING MIGRATION, TRANSACTION ROLLED BACK ---', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
