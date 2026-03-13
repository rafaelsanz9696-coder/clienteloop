import { Router } from 'express';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { checkConflict, getAvailableSlots } from '../lib/appointments.js';
import { logActivity } from '../lib/activity.js';
import { sendDirectWhatsApp } from '../channels/whatsapp.adapter.js';

const router = Router();

// GET /api/appointments/slots?date=YYYY-MM-DD&duration=60
router.get('/slots', async (req: AuthenticatedRequest, res) => {
  try {
    const bid    = req.user!.business_id;
    const date   = req.query.date as string;
    const dur    = parseInt(req.query.duration as string) || 60;

    if (!date) return res.status(400).json({ error: 'date is required' });

    const slots = await getAvailableSlots(bid, date, dur);
    res.json(slots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// GET /api/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid  = req.user!.business_id;
    const from = req.query.from as string;
    const to   = req.query.to   as string;

    let query = `
      SELECT a.*, c.name as contact_name, s.name as service_name
      FROM appointments a
      LEFT JOIN contacts c ON c.id = a.contact_id
      LEFT JOIN services s ON s.id = a.service_id
      WHERE a.business_id = $1
    `;
    const params: any[] = [bid];

    if (from) { params.push(from); query += ` AND a.start_time >= $${params.length}`; }
    if (to)   { params.push(to + 'T23:59:59'); query += ` AND a.start_time <= $${params.length}`; }

    query += ' ORDER BY a.start_time ASC';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/appointments
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const { contact_id, service_id, title, start_time, duration_minutes = 60, notes = '' } = req.body;

    if (!title || !start_time) {
      return res.status(400).json({ error: 'title and start_time are required' });
    }

    const start = new Date(start_time);
    const end   = new Date(start.getTime() + duration_minutes * 60 * 1000);

    const conflict = await checkConflict(bid, start, end);
    if (conflict.hasConflict) {
      return res.status(409).json({
        error: 'Conflict: the selected time slot is already booked',
        conflicting: conflict.conflicting.map((c) => ({
          id: c.id,
          title: c.title,
          contact_name: c.contact_name,
          start_time: c.start_time,
          end_time: c.end_time,
        })),
      });
    }

    const { rows } = await db.query(
      `INSERT INTO appointments (business_id, contact_id, service_id, title, start_time, end_time, duration_minutes, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [bid, contact_id || null, service_id || null, title, start.toISOString(), end.toISOString(), duration_minutes, notes]
    );

    if (contact_id) {
      logActivity(bid, contact_id, 'appointment_created', `Cita "${title}" agendada para ${start.toLocaleString('es-MX')}`);
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PUT /api/appointments/:id
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const { title, contact_id, service_id, start_time, duration_minutes, notes, status } = req.body;

    const start = start_time ? new Date(start_time) : null;
    let end: Date | null = null;

    if (start && duration_minutes) {
      end = new Date(start.getTime() + duration_minutes * 60 * 1000);
      const conflict = await checkConflict(bid, start, end, Number(req.params.id));
      if (conflict.hasConflict) {
        return res.status(409).json({
          error: 'Conflict: the selected time slot is already booked',
          conflicting: conflict.conflicting,
        });
      }
    }

    const { rows } = await db.query(
      `UPDATE appointments
       SET title=COALESCE($1,title),
           contact_id=COALESCE($2,contact_id),
           service_id=COALESCE($3,service_id),
           start_time=COALESCE($4,start_time),
           end_time=COALESCE($5,end_time),
           duration_minutes=COALESCE($6,duration_minutes),
           notes=COALESCE($7,notes),
           status=COALESCE($8,status)
       WHERE id=$9 AND business_id=$10 RETURNING *`,
      [title, contact_id, service_id,
       start?.toISOString(), end?.toISOString(),
       duration_minutes, notes, status,
       req.params.id, bid]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PATCH /api/appointments/:id/status
router.patch('/:id/status', async (req: AuthenticatedRequest, res) => {
  try {
    const { status } = req.body;
    const valid = ['confirmed', 'pending', 'cancelled', 'completed'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    await db.query(
      'UPDATE appointments SET status=$1 WHERE id=$2 AND business_id=$3',
      [status, req.params.id, req.user!.business_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/appointments/:id/remind — manual WhatsApp reminder
router.post('/:id/remind', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;

    // Load appointment with contact + business info
    const { rows } = await db.query(`
      SELECT a.id, a.title, a.start_time, a.reminder_sent_at,
             ct.name AS contact_name, ct.phone AS phone,
             b.name  AS business_name
      FROM appointments a
      JOIN contacts ct   ON ct.id = a.contact_id
      JOIN businesses b  ON b.id  = a.business_id
      WHERE a.id = $1 AND a.business_id = $2
    `, [req.params.id, bid]);

    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const appt = rows[0];

    if (!appt.phone) {
      return res.status(400).json({ sent: false, reason: 'Contact has no phone number' });
    }

    // Resolve phoneId
    const { rows: cRows } = await db.query(
      `SELECT identifier FROM channel_numbers WHERE business_id = $1 AND channel = 'whatsapp' LIMIT 1`,
      [bid]
    );
    const phoneId = cRows[0]?.identifier ?? process.env.META_PHONE_ID ?? '';

    if (!phoneId) {
      return res.status(400).json({ sent: false, reason: 'No WhatsApp phoneId configured' });
    }

    const startTime = new Date(appt.start_time);
    const dayStr = startTime.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = startTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

    const message =
      `Hola ${appt.contact_name} 👋 Te recordamos que tu cita de *${appt.title}* en *${appt.business_name}* ` +
      `es el *${dayStr}* a las *${timeStr}*. ¡Te esperamos! 📅\n\n` +
      `Si necesitas cambiar o cancelar, avísanos con tiempo.`;

    const result = await sendDirectWhatsApp(appt.phone, message, phoneId);

    if (result.sent) {
      await db.query(
        'UPDATE appointments SET reminder_sent_at = NOW() WHERE id = $1',
        [appt.id]
      );
      // Re-fetch updated row
      const { rows: updated } = await db.query(
        `SELECT a.*, ct.name as contact_name, s.name as service_name
         FROM appointments a
         LEFT JOIN contacts ct ON ct.id = a.contact_id
         LEFT JOIN services  s ON s.id  = a.service_id
         WHERE a.id = $1`, [appt.id]
      );
      return res.json({ sent: true, phone: appt.phone, appointment: updated[0] });
    }

    res.json({ sent: false, reason: result.reason });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// DELETE /api/appointments/:id
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    await db.query(
      'DELETE FROM appointments WHERE id=$1 AND business_id=$2',
      [req.params.id, req.user!.business_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
