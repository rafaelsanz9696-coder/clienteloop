import { Router } from 'express';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/quick-replies?category=saludo
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const category = req.query.category as string;

    let query = 'SELECT * FROM quick_replies WHERE business_id = $1';
    const params: any[] = [bid];

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    query += ' ORDER BY category, title';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// GET /api/quick-replies/:id
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const { rows } = await db.query(
      'SELECT * FROM quick_replies WHERE id = $1 AND business_id = $2',
      [req.params.id, bid],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Quick reply not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/quick-replies
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const business_id = req.user!.business_id;
    const { title, content, category = 'general' } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'title and content are required' });

    const result = await db.query(
      'INSERT INTO quick_replies (business_id, title, content, category) VALUES ($1, $2, $3, $4) RETURNING *',
      [business_id, title, content, category]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// PUT /api/quick-replies/:id
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    const { title, content, category } = req.body;
    const { rows } = await db.query(
      'UPDATE quick_replies SET title=COALESCE($1,title), content=COALESCE($2,content), category=COALESCE($3,category) WHERE id=$4 AND business_id=$5 RETURNING *',
      [title, content, category, req.params.id, bid]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Quick reply not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// DELETE /api/quick-replies/:id
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    await db.query('DELETE FROM quick_replies WHERE id = $1 AND business_id = $2', [req.params.id, bid]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/quick-replies/presets
router.post('/presets', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;
    
    // Get business name and nicho
    const { rows: bRows } = await db.query('SELECT name, nicho FROM businesses WHERE id = $1', [bid]);
    const biz = bRows[0] || { name: 'ClienteLoop Partner', nicho: 'general' };
    const bName = biz.name || 'ClienteLoop Partner';
    const nichoRaw = biz.nicho || 'general';

    // Map nicho to readable Spanish terms
    let nichoWord = 'servicios profesionales';
    if (nichoRaw === 'salon' || nichoRaw.includes('salon') || nichoRaw.includes('beauty')) {
      nichoWord = 'belleza y cuidado personal';
    } else if (nichoRaw === 'dental' || nichoRaw.includes('dentist') || nichoRaw.includes('salud') || nichoRaw.includes('clinic')) {
      nichoWord = 'salud dental y bienestar';
    } else if (nichoRaw.includes('real') || nichoRaw.includes('inmobil')) {
      nichoWord = 'asesoría inmobiliaria';
    } else if (nichoRaw.includes('gym') || nichoRaw.includes('fit') || nichoRaw.includes('deport')) {
      nichoWord = 'entrenamiento y acondicionamiento físico';
    } else if (nichoRaw.includes('ecommerce') || nichoRaw.includes('shop') || nichoRaw.includes('tienda')) {
      nichoWord = 'venta y distribución de productos premium';
    }

    const presets = [
      {
        title: '👋 Saludo Inicial',
        category: 'saludo',
        content: `¡Hola, {{nombre}}! 👋 Qué gusto saludarte. Te damos la bienvenida a *${bName}*. Somos especialistas en ${nichoWord}. ✨ ¿En qué podemos ayudarte hoy?`
      },
      {
        title: '📋 Catálogo de Servicios y Precios',
        category: 'servicios',
        content: `Claro, {{nombre}}. Aquí tienes nuestra lista de servicios y soluciones en *${bName}*:\n\n1️⃣ Plan de Entrada — Ajuste inicial y asesoría básica\n2️⃣ Tratamiento / Servicio Premium — Atención de alta gama y seguimiento\n3️⃣ Asistencia Especializada — Soluciones avanzadas a la medida\n\nPuedes reservar tu cita en el horario que prefieras directamente desde aquí: 📅 {{booking_link}}\n\n¿Cuál de estos te gustaría programar hoy?`
      },
      {
        title: '📍 Ubicación y Cómo Llegar',
        category: 'ubicacion',
        content: `¡Con gusto, {{nombre}}! 📍 Nos encontramos ubicados en la zona central de la ciudad. Contamos con de estacionamiento gratuito y acceso seguro para todos nuestros clientes.\n\nPuedes ver la ubicación exacta y cómo llegar desde Google Maps ingresando aquí: [Dirección de Google Maps]. ¡Te esperamos con el mejor servicio!`
      },
      {
        title: '🕒 Horarios de Atención',
        category: 'horarios',
        content: `Hola, {{nombre}}. En *${bName}* atendemos en los siguientes horarios: 🕒\n\n📅 Lunes a Viernes: 9:00 AM a 7:00 PM\n📅 Sábados: 9:00 AM a 2:00 PM\n📅 Domingos: Cerrado\n\n¿Te gustaría que agendemos un espacio para esta semana?`
      },
      {
        title: '🚀 Seguimiento Amigable',
        category: 'seguimiento',
        content: `¡Hola, {{nombre}}! 👋 Te escribo brevemente de parte de *${bName}* para ver si tuviste oportunidad de revisar la información de tu interés o si te quedó alguna duda.\n\nQueremos asegurarnos de darte el mejor acompañamiento. ¡Estamos listos para atenderte!`
      }
    ];

    // Clear existing quick replies for this business
    await db.query('DELETE FROM quick_replies WHERE business_id = $1', [bid]);

    // Insert new ones in batch
    const insertedRows: any[] = [];
    for (const p of presets) {
      const { rows } = await db.query(
        'INSERT INTO quick_replies (business_id, title, content, category) VALUES ($1, $2, $3, $4) RETURNING *',
        [bid, p.title, p.content, p.category]
      );
      insertedRows.push(rows[0]);
    }

    res.status(201).json(insertedRows);
  } catch (err) {
    console.error('[Quick Replies Presets Error]', err);
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
