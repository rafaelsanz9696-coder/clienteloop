import db from '../db/database.js';
import { sendDirectWhatsApp } from '../channels/whatsapp.adapter.js';

/** Replace {{nombre}} template variables with actual contact name */
function interpolate(template: string, name: string): string {
  return template.replace(/\{\{nombre\}\}/gi, name);
}

/** Sleep helper */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Send a broadcast to all pending recipients.
 * Processes sequentially with 1.2s delay between sends to respect Meta rate limits.
 * Updates broadcast/recipient status as it goes.
 */
export async function executeBroadcast(broadcastId: number): Promise<void> {
  // Mark broadcast as sending
  await db.query(
    `UPDATE broadcasts SET status = 'sending', sent_at = NOW() WHERE id = $1`,
    [broadcastId]
  );

  const { rows: bRows } = await db.query(
    'SELECT * FROM broadcasts WHERE id = $1',
    [broadcastId]
  );
  if (bRows.length === 0) return;
  const broadcast = bRows[0];

  // Resolve per-business phoneId and token
  const { rows: chRows } = await db.query(
    `SELECT identifier, access_token FROM channel_numbers
     WHERE business_id = $1 AND channel = 'whatsapp'
     LIMIT 1`,
    [broadcast.business_id]
  );
  const phoneId     = chRows[0]?.identifier   ?? process.env.META_PHONE_ID ?? '';
  const accessToken = chRows[0]?.access_token ?? undefined;

  if (!phoneId) {
    await db.query(
      `UPDATE broadcasts SET status = 'failed' WHERE id = $1`,
      [broadcastId]
    );
    console.warn(`[Broadcast #${broadcastId}] No phoneId — aborting`);
    return;
  }

  // Get all pending recipients
  const { rows: recipients } = await db.query(
    `SELECT * FROM broadcast_recipients
     WHERE broadcast_id = $1 AND status = 'pending'
     ORDER BY id ASC`,
    [broadcastId]
  );

  console.log(`[Broadcast #${broadcastId}] Sending to ${recipients.length} recipients`);

  let sentCount = broadcast.sent_count as number;
  let failedCount = broadcast.failed_count as number;

  for (const r of recipients) {
    const text = interpolate(broadcast.message, r.name);
    const result = await sendDirectWhatsApp(r.phone, text, phoneId, accessToken);

    if (result.sent) {
      await db.query(
        `UPDATE broadcast_recipients SET status = 'sent', sent_at = NOW() WHERE id = $1`,
        [r.id]
      );
      sentCount++;
      console.log(`[Broadcast #${broadcastId}] ✅ Sent to ${r.name} (+${r.phone})`);
    } else {
      await db.query(
        `UPDATE broadcast_recipients SET status = 'failed', error = $1 WHERE id = $2`,
        [result.reason ?? 'Unknown error', r.id]
      );
      failedCount++;
      console.warn(`[Broadcast #${broadcastId}] ⚠️ Failed for ${r.name}: ${result.reason}`);
    }

    // Update running totals on the broadcast row
    await db.query(
      `UPDATE broadcasts SET sent_count = $1, failed_count = $2 WHERE id = $3`,
      [sentCount, failedCount, broadcastId]
    );

    // 1.2 second delay between sends (Meta recommends ≥1s for template messages)
    await sleep(1200);
  }

  // Mark broadcast complete
  await db.query(
    `UPDATE broadcasts SET status = 'completed' WHERE id = $1`,
    [broadcastId]
  );

  console.log(`[Broadcast #${broadcastId}] ✅ Done — ${sentCount} sent, ${failedCount} failed`);
}
