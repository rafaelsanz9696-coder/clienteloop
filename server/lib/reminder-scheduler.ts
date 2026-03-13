import db from '../db/database.js';
import { sendDirectWhatsApp } from '../channels/whatsapp.adapter.js';

/**
 * Build the WhatsApp reminder message text.
 */
function buildReminderMessage(
  title: string,
  contactName: string,
  startTime: Date,
  businessName: string
): string {
  const dayStr = startTime.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeStr = startTime.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    `Hola ${contactName} 👋 Te recordamos que tu cita de *${title}* en *${businessName}* ` +
    `es mañana *${dayStr}* a las *${timeStr}*. ¡Te esperamos! 📅\n\n` +
    `Si necesitas cambiar o cancelar, avísanos con tiempo.`
  );
}

/**
 * Main scheduler function — called every 5 minutes.
 * Finds appointments starting in 23–25h that haven't had a reminder sent yet,
 * and sends a WhatsApp message directly to the contact's phone.
 */
export async function checkAndSendReminders(): Promise<void> {
  const { rows } = await db.query(`
    SELECT
      a.id,
      a.title,
      a.start_time,
      ct.name  AS contact_name,
      ct.phone AS phone,
      b.id     AS business_id,
      b.name   AS business_name
    FROM appointments a
    JOIN contacts ct      ON ct.id = a.contact_id
    JOIN businesses b     ON b.id  = a.business_id
    WHERE a.status IN ('confirmed', 'pending')
      AND a.reminder_sent_at IS NULL
      AND a.contact_id IS NOT NULL
      AND ct.phone IS NOT NULL
      AND a.start_time BETWEEN NOW() + INTERVAL '23 hours'
                           AND NOW() + INTERVAL '25 hours'
  `);

  if (rows.length === 0) return;

  console.log(`[Scheduler] ${rows.length} reminder(s) to send`);

  for (const appt of rows) {
    // Resolve phoneId: prefer channel_numbers table, fallback to env var
    const { rows: channelRows } = await db.query(
      `SELECT identifier FROM channel_numbers
       WHERE business_id = $1 AND channel = 'whatsapp'
       LIMIT 1`,
      [appt.business_id]
    );

    const phoneId =
      channelRows[0]?.identifier ?? process.env.META_PHONE_ID ?? '';

    if (!phoneId) {
      console.warn(`[Scheduler] No phoneId for business ${appt.business_id} — skipping appt ${appt.id}`);
      continue;
    }

    const message = buildReminderMessage(
      appt.title,
      appt.contact_name,
      new Date(appt.start_time),
      appt.business_name
    );

    const result = await sendDirectWhatsApp(appt.phone!, message, phoneId);

    if (result.sent) {
      await db.query(
        'UPDATE appointments SET reminder_sent_at = NOW() WHERE id = $1',
        [appt.id]
      );
      console.log(`[Scheduler] ✅ Reminder sent for appt ${appt.id} (${appt.title})`);
    } else {
      console.warn(`[Scheduler] ⚠️ Failed for appt ${appt.id}: ${result.reason}`);
    }
  }
}
