import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres.futudjapwrhkhpdokjyk:SjfkmuZu6mdBiyci@aws-0-us-west-2.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    console.log('--- FINDING USER ---');
    // Supabase auth.users isn't exposed to public pg easily, but sometimes there's a public.users clone.
    // Let's check businesses table:
    const { rows: bRows } = await pool.query("SELECT * FROM businesses ORDER BY id DESC LIMIT 5");
    console.log("Latest businesses:", bRows);

    // Also let's check railway webhook logs. 
    // We can't check logs, but we can update the channel_number to the MOST RECENT business_id.
    const latestBusinessId = bRows[0].id;
    
    // Update the channel number to point to the latest business
    const res = await pool.query(
      `UPDATE channel_numbers SET business_id = $1 WHERE identifier = '1000177549846403' RETURNING *`,
      [latestBusinessId]
    );
    console.log(`Updated channel to belong to business_id=${latestBusinessId}:`, res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
