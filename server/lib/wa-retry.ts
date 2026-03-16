import db from '../db/database.js';
import { sendDirectWhatsApp } from '../channels/whatsapp.adapter.js';

const BACKOFF_MINUTES = [2, 5, 15]; // delay before retry attempt 1, 2, 3

export async function enqueueRetry(
  businessId: number | null,
  conversationId: number | null,
  toPhone: string,
  content: string,
  messageId?: number,
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO wa_retry_queue
         (business_id, conversation_id, to_phone, content, message_id, next_retry_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '2 minutes')`,
      [businessId ?? 0, conversationId, toPhone, content, messageId ?? null],
    );
    console.log(`[RetryQueue] Enqueued retry for +${toPhone.replace(/\D/g, '')}`);
  } catch (err) {
    console.error('[RetryQueue] Failed to enqueue:', err);
  }
}

export async function processRetryQueue(): Promise<void> {
  const { rows } = await db.query(
    `SELECT id, business_id, conversation_id, to_phone, content, message_id,
            attempt_count, max_attempts
     FROM wa_retry_queue
     WHERE status = 'pending' AND next_retry_at <= NOW()
     ORDER BY next_retry_at ASC
     LIMIT 20`,
  ) as { rows: Array<{
    id: number;
    business_id: number;
    conversation_id: number | null;
    to_phone: string;
    content: string;
    message_id: number | null;
    attempt_count: number;
    max_attempts: number;
  }> };

  if (rows.length > 0) {
    console.log(`[RetryQueue] Processing ${rows.length} pending item(s)`);
  }

  const phoneId = process.env.META_PHONE_ID ?? '';

  for (const row of rows) {
    const result = await sendDirectWhatsApp(row.to_phone, row.content, phoneId);

    if (result.sent) {
      await db.query(
        `UPDATE wa_retry_queue SET status = 'delivered' WHERE id = $1`,
        [row.id],
      );
      if (row.message_id) {
        await db.query(
          `UPDATE messages SET delivery_status = 'delivered' WHERE id = $1`,
          [row.message_id],
        );
      }
      console.log(`[RetryQueue] ✅ Delivered to ${row.to_phone} (attempt ${row.attempt_count + 1})`);
    } else {
      const newCount = row.attempt_count + 1;
      if (newCount >= row.max_attempts) {
        await db.query(
          `UPDATE wa_retry_queue SET status = 'failed', attempt_count = $1, last_error = $2 WHERE id = $3`,
          [newCount, result.reason ?? 'Max attempts reached', row.id],
        );
        if (row.message_id) {
          await db.query(
            `UPDATE messages SET delivery_status = 'failed' WHERE id = $1`,
            [row.message_id],
          );
        }
        console.log(`[RetryQueue] ❌ Permanently failed for ${row.to_phone}: ${result.reason}`);
      } else {
        const delayMins = BACKOFF_MINUTES[newCount] ?? 30;
        await db.query(
          `UPDATE wa_retry_queue
           SET attempt_count = $1, last_error = $2,
               next_retry_at = NOW() + ($3 * INTERVAL '1 minute')
           WHERE id = $4`,
          [newCount, result.reason ?? 'Send failed', delayMins, row.id],
        );
        console.log(`[RetryQueue] Retry ${newCount}/${row.max_attempts} scheduled in ${delayMins}min for ${row.to_phone}`);
      }
    }
  }
}
