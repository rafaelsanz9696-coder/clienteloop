import { Router } from 'express';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { logActivity } from '../lib/activity.js';

const router = Router();

// GET /api/contacts?stage=new&search=maria&tag=VIP
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const stage = req.query.stage as string;
    const search = req.query.search as string;
    const tag = req.query.tag as string;

    let query = 'SELECT * FROM contacts WHERE business_id = $1';
    const params: any[] = [bid];

    if (stage) {
      params.push(stage);
      query += ` AND pipeline_stage = $${params.length}`;
    }
    if (search) {
      const like = `%${search}%`;
      query += ` AND (name ILIKE $${params.length + 1} OR phone ILIKE $${params.length + 2} OR email ILIKE $${params.length + 3})`;
      params.push(like, like, like);
    }
    if (tag) {
      // Filter contacts whose JSON tags array contains the tag value
      params.push(JSON.stringify([tag]));
      query += ` AND (tags::jsonb @> $${params.length}::jsonb)`;
    }
    query += ' ORDER BY last_contact_at DESC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// GET /api/contacts/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM contacts WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Contact not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/contacts
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const business_id = req.user!.business_id;
    const { name, phone, email, channel = 'whatsapp', pipeline_stage = 'new', notes = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows } = await db.query(`
      INSERT INTO contacts (business_id, name, phone, email, channel, pipeline_stage, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [business_id, name, phone || null, email || null, channel, pipeline_stage, notes]);

    logActivity(business_id, rows[0].id, 'contact_created', `Contacto ${name} creado`);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PUT /api/contacts/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, email, channel, pipeline_stage, status, notes, tags } = req.body;
    const { rows } = await db.query(`
      UPDATE contacts
      SET name=COALESCE($1,name), phone=COALESCE($2,phone), email=COALESCE($3,email),
          channel=COALESCE($4,channel), pipeline_stage=COALESCE($5,pipeline_stage),
          status=COALESCE($6,status), notes=COALESCE($7,notes), tags=COALESCE($8,tags),
          last_contact_at=CURRENT_TIMESTAMP
      WHERE id=$9 RETURNING *
    `, [name, phone, email, channel, pipeline_stage, status, notes, tags, req.params.id]);

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PATCH /api/contacts/:id/stage
router.patch('/:id/stage', async (req, res) => {
  try {
    const { stage } = req.body;
    await db.query('UPDATE contacts SET pipeline_stage=$1, last_contact_at=CURRENT_TIMESTAMP WHERE id=$2', [stage, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const id = req.params.id;
    // Cascade manually: remove FK-blocked rows before deleting the contact
    await db.query('DELETE FROM pipeline_deals WHERE contact_id=$1', [id]);
    await db.query('DELETE FROM conversations WHERE contact_id=$1', [id]); // messages cascade from conversations
    await db.query('DELETE FROM contacts WHERE id=$1 AND business_id=$2', [id, bid]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// GET /api/contacts/export — download all contacts as UTF-8 CSV (BOM for Excel)
router.get('/export', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const { rows } = await db.query(
      `SELECT name, phone, email, channel, pipeline_stage, tags, notes, created_at
       FROM contacts WHERE business_id = $1 ORDER BY name ASC`,
      [bid]
    );
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Nombre', 'Telefono', 'Email', 'Canal', 'Etapa', 'Etiquetas', 'Notas', 'Creado'].map(esc).join(',');
    const csvRows = rows.map(c => {
      const tagList = (() => { try { return (JSON.parse(c.tags) as string[]).join('; '); } catch { return ''; } })();
      return [
        c.name, c.phone || '', c.email || '', c.channel,
        c.pipeline_stage, tagList, (c.notes || '').replace(/\n/g, ' '),
        new Date(c.created_at).toLocaleDateString('es-MX'),
      ].map(esc).join(',');
    });
    const csv = '\uFEFF' + [header, ...csvRows].join('\r\n');
    const filename = `contactos_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/contacts/import — upsert contacts from CSV text in JSON body
router.post('/import', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const { csv } = req.body as { csv: string };
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'CSV content required' });

    function parseCSVLine(line: string): string[] {
      const cols: string[] = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
        else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      cols.push(cur.trim());
      return cols;
    }

    const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
    if (lines.length < 2) return res.status(400).json({ error: 'CSV necesita encabezado + al menos una fila' });

    const hdrs = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
    const find = (names: string[]) => names.reduce<number>((f, n) => f >= 0 ? f : hdrs.indexOf(n), -1);
    const nameIdx    = find(['nombre', 'name', 'contacto']);
    const phoneIdx   = find(['telefono', 'phone', 'tel', 'celular']);
    const emailIdx   = find(['email', 'correo']);
    const channelIdx = find(['canal', 'channel']);
    const stageIdx   = find(['etapa', 'stage', 'pipelinestage']);
    const notesIdx   = find(['notas', 'notes', 'nota']);

    if (nameIdx < 0) return res.status(400).json({ error: 'El CSV necesita una columna "Nombre" o "Name"' });

    let inserted = 0, updated = 0, skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      try {
        const cols    = parseCSVLine(lines[i]);
        const name    = cols[nameIdx]?.trim() || '';
        const phone   = phoneIdx  >= 0 ? (cols[phoneIdx]?.trim().replace(/\D/g, '') || null) : null;
        const email   = emailIdx  >= 0 ? (cols[emailIdx]?.trim() || null) : null;
        const channel = channelIdx >= 0 ? (cols[channelIdx]?.trim() || 'whatsapp') : 'whatsapp';
        const stage   = stageIdx  >= 0 ? (cols[stageIdx]?.trim()  || 'new')  : 'new';
        const notes   = notesIdx  >= 0 ? (cols[notesIdx]?.trim()  || '')    : '';

        if (!name) { skipped++; continue; }

        if (phone) {
          const { rows } = await db.query(
            `INSERT INTO contacts (business_id, name, phone, email, channel, pipeline_stage, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (phone, business_id) DO UPDATE
               SET name=$2, email=COALESCE($4, contacts.email), channel=$5,
                   pipeline_stage=$6, notes=COALESCE(NULLIF($7,''), contacts.notes),
                   last_contact_at=CURRENT_TIMESTAMP
             RETURNING (xmax = 0) AS inserted`,
            [bid, name, phone, email, channel, stage, notes]
          );
          if (rows[0]?.inserted) inserted++; else updated++;
        } else {
          await db.query(
            `INSERT INTO contacts (business_id, name, email, channel, pipeline_stage, notes)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [bid, name, email, channel, stage, notes]
          );
          inserted++;
        }
      } catch (err: any) {
        errors.push(`Fila ${i + 1}: ${err.message}`);
      }
    }

    res.json({ inserted, updated, skipped, errors: errors.slice(0, 10) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
