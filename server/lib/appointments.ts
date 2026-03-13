import db from '../db/database.js';

interface WorkingHours {
  open: string;   // "9:00"
  close: string;  // "18:00"
}

/** Parse the business working_hours JSON for a given day-of-week (0=Sun, 1=Mon…6=Sat). */
function parseWorkingHours(workingHoursJson: string, dayOfWeek: number): WorkingHours | null {
  try {
    const wh = JSON.parse(workingHoursJson) as Record<string, string>;

    let raw: string | undefined;
    if (dayOfWeek === 0) raw = wh.sunday;
    else if (dayOfWeek === 6) raw = wh.saturday;
    else raw = wh.weekdays;

    if (!raw || raw.toLowerCase() === 'cerrado') return null;

    const [open, close] = raw.split('-').map((s) => s.trim());
    if (!open || !close) return null;

    return { open, close };
  } catch {
    return { open: '9:00', close: '18:00' };
  }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Check if a new appointment [startTime, endTime) overlaps with any existing
 * confirmed/pending appointment for this business.
 */
export async function checkConflict(
  businessId: number,
  startTime: Date,
  endTime: Date,
  excludeId?: number
): Promise<{ hasConflict: boolean; conflicting: any[] }> {
  const params: any[] = [businessId, startTime.toISOString(), endTime.toISOString()];
  let query = `
    SELECT a.*, c.name as contact_name
    FROM appointments a
    LEFT JOIN contacts c ON c.id = a.contact_id
    WHERE a.business_id = $1
      AND a.status IN ('confirmed', 'pending')
      AND a.start_time < $3
      AND a.end_time   > $2
  `;

  if (excludeId) {
    params.push(excludeId);
    query += ` AND a.id != $${params.length}`;
  }

  const { rows } = await db.query(query, params);
  return { hasConflict: rows.length > 0, conflicting: rows };
}

/**
 * Return available start-time slots ("HH:MM") for a given date and duration.
 * Slots are generated every 30 minutes within working hours, excluding booked windows.
 */
export async function getAvailableSlots(
  businessId: number,
  date: string,        // "YYYY-MM-DD"
  durationMinutes: number
): Promise<string[]> {
  // Get business working hours
  const { rows: bizRows } = await db.query(
    'SELECT working_hours FROM businesses WHERE id = $1',
    [businessId]
  );
  if (bizRows.length === 0) return [];

  const d = new Date(date + 'T00:00:00');
  const dayOfWeek = d.getDay();
  const hours = parseWorkingHours(bizRows[0].working_hours, dayOfWeek);
  if (!hours) return []; // closed this day

  const openMin  = timeToMinutes(hours.open);
  const closeMin = timeToMinutes(hours.close);

  // Get existing appointments for this day
  const dayStart = new Date(date + 'T00:00:00.000Z');
  const dayEnd   = new Date(date + 'T23:59:59.999Z');
  const { rows: existing } = await db.query(
    `SELECT start_time, end_time FROM appointments
     WHERE business_id = $1 AND status IN ('confirmed','pending')
       AND start_time >= $2 AND start_time <= $3`,
    [businessId, dayStart.toISOString(), dayEnd.toISOString()]
  );

  const bookedRanges = existing.map((r: any) => {
    const s = new Date(r.start_time);
    const e = new Date(r.end_time);
    return {
      start: s.getHours() * 60 + s.getMinutes(),
      end:   e.getHours() * 60 + e.getMinutes(),
    };
  });

  const slots: string[] = [];
  const now = new Date();
  const isToday = date === now.toISOString().split('T')[0];
  const currentMin = isToday ? now.getHours() * 60 + now.getMinutes() + 30 : 0;

  for (let min = openMin; min + durationMinutes <= closeMin; min += 30) {
    if (isToday && min <= currentMin) continue;

    const slotEnd = min + durationMinutes;
    const hasOverlap = bookedRanges.some((r) => min < r.end && slotEnd > r.start);
    if (!hasOverlap) {
      const h = String(Math.floor(min / 60)).padStart(2, '0');
      const m = String(min % 60).padStart(2, '0');
      slots.push(`${h}:${m}`);
    }
  }

  return slots;
}

/**
 * Format available slots for the next N days as a readable string for the AI.
 */
export async function buildScheduleContext(
  businessId: number,
  days: number = 3,
  slotDurationMinutes: number = 60
): Promise<string> {
  const lines: string[] = [];
  const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  for (let i = 0; i <= days; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : DAY_NAMES[d.getDay()];

    const slots = await getAvailableSlots(businessId, dateStr, slotDurationMinutes);
    if (slots.length > 0) {
      lines.push(`${dayName} ${dateStr}: ${slots.slice(0, 8).join(', ')}`);
    } else {
      lines.push(`${dayName} ${dateStr}: Sin disponibilidad`);
    }
  }

  return lines.join('\n');
}
