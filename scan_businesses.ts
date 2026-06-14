import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres.futudjapwrhkhpdokjyk:SjfkmuZu6mdBiyci@aws-0-us-west-2.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    console.log('--- SCANNING BUSINESSES AND USERS ---');

    const businesses = await pool.query(`SELECT * FROM businesses`);
    console.log('Businesses:', businesses.rows);

    const members = await pool.query(`SELECT * FROM business_members`);
    console.log('Business Members:', members.rows);

    const contacts = await pool.query(`SELECT id, business_id, name, phone, channel FROM contacts`);
    console.log('Contacts:', contacts.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
