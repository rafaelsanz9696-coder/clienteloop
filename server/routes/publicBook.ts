/**
 * Public booking routes — NO auth required.
 * Used by the client-facing /book/:slug page.
 */
import { Router, Request, Response } from 'express';
import db from '../db/database.js';
import { checkConflict, getAvailableSlots } from '../lib/appointments.js';
import { logActivity } from '../lib/activity.js';

const router = Router();

/** Resolve business by booking_slug OR numeric id */
async function findBusiness(slug: string) {
  // Try slug first
  const { rows } = await db.query(
    `SELECT id, name, nicho, booking_slug, working_hours
     FROM businesses
     WHERE booking_slug = $1
     LIMIT 1`,
    [slug]
  );
  if (rows.length > 0) return rows[0];

  // Fallback: numeric id
  if (/^\d+$/.test(slug)) {
    const { rows: r2 } = await db.query(
      `SELECT id, name, nicho, booking_slug, working_hours
       FROM businesses WHERE id = $1 LIMIT 1`,
      [Number(slug)]
    );
    if (r2.length > 0) return r2[0];
  }

  return null;
}

// ─── GET /api/public/book/:slug ───────────────────────────────────────────────
// Returns business info + active services
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const business = await findBusiness(req.params.slug);
    if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });

    const { rows: services } = await db.query(
      `SELECT id, name, duration_minutes, price
       FROM services
       WHERE business_id = $1 AND active = true
       ORDER BY name ASC`,
      [business.id]
    );

    res.json({
      business: {
        id: business.id,
        name: business.name,
        nicho: business.nicho,
        booking_slug: business.booking_slug,
      },
      services,
    });
  } catch (err) {
    console.error('[PublicBook] GET /:slug error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/public/book/:slug/slots ────────────────────────────────────────
// Returns available time slots
router.get('/:slug/slots', async (req: Request, res: Response) => {
  try {
    const business = await findBusiness(req.params.slug);
    if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });

    const date = req.query.date as string;
    const duration = parseInt(req.query.duration as string) || 60;

    if (!date) return res.status(400).json({ error: 'date is required' });

    const slots = await getAvailableSlots(business.id, date, duration);
    res.json(slots);
  } catch (err) {
    console.error('[PublicBook] GET /:slug/slots error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/public/book/:slug ─────────────────────────────────────────────
// Create appointment + upsert contact
router.post('/:slug', async (req: Request, res: Response) => {
  try {
    const business = await findBusiness(req.params.slug);
    if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });

    const {
      service_id,
      start_time,
      duration_minutes = 60,
      client_name,
      client_phone,
      client_email,
      notes = '',
    } = req.body;

    if (!start_time || !client_name?.trim()) {
      return res.status(400).json({ error: 'start_time and client_name are required' });
    }

    const start = new Date(start_time);
    const end   = new Date(start.getTime() + duration_minutes * 60 * 1000);

    // Conflict check
    const conflict = await checkConflict(business.id, start, end);
    if (conflict.hasConflict) {
      return res.status(409).json({ error: 'El horario ya no está disponible, elige otro.' });
    }

    // Upsert contact (match by phone if provided, else create new)
    let contactId: number | null = null;
    if (client_phone) {
      const cleanPhone = client_phone.replace(/\D/g, '');
      if (cleanPhone) {
        const { rows: existing } = await db.query(
          `SELECT id FROM contacts WHERE business_id = $1 AND phone = $2 LIMIT 1`,
          [business.id, cleanPhone]
        );
        if (existing.length > 0) {
          contactId = existing[0].id;
        } else {
          const { rows: created } = await db.query(
            `INSERT INTO contacts (business_id, name, phone, email, channel, pipeline_stage)
             VALUES ($1, $2, $3, $4, 'whatsapp', 'new') RETURNING id`,
            [business.id, client_name.trim(), cleanPhone, client_email?.trim() || null]
          );
          contactId = created[0].id;
        }
      }
    } else {
      // No phone — create contact by name
      const { rows: created } = await db.query(
        `INSERT INTO contacts (business_id, name, phone, email, channel, pipeline_stage)
         VALUES ($1, $2, NULL, $3, 'whatsapp', 'new') RETURNING id`,
        [business.id, client_name.trim(), client_email?.trim() || null]
      );
      contactId = created[0].id;
    }

    // Get service title
    let serviceTitle = '';
    if (service_id) {
      const { rows: sr } = await db.query(
        'SELECT name FROM services WHERE id = $1 AND business_id = $2',
        [service_id, business.id]
      );
      if (sr.length > 0) serviceTitle = sr[0].name;
    }

    const title = serviceTitle
      ? `${serviceTitle} — ${client_name.trim()}`
      : client_name.trim();

    // Create appointment
    const { rows: appt } = await db.query(
      `INSERT INTO appointments
         (business_id, contact_id, service_id, title, start_time, end_time, duration_minutes, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING *`,
      [
        business.id,
        contactId,
        service_id || null,
        title,
        start.toISOString(),
        end.toISOString(),
        duration_minutes,
        notes.trim(),
      ]
    );

    if (contactId) {
      logActivity(
        business.id,
        contactId,
        'appointment_created',
        `Cita "${title}" agendada via link público para ${start.toLocaleString('es-MX')}`
      );
    }

    res.status(201).json({
      appointment: {
        id: appt[0].id,
        title: appt[0].title,
        start_time: appt[0].start_time,
        end_time: appt[0].end_time,
        duration_minutes: appt[0].duration_minutes,
        status: appt[0].status,
      },
      business_name: business.name,
    });
  } catch (err) {
    console.error('[PublicBook] POST /:slug error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
