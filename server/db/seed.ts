import db from './database.js';

console.log('🌱 Seeding PostgreSQL database...');

async function seed() {
  try {
    // ─── Business 1 ────────────────────────────────────────────────────────
    const { rows: existingBusiness } = await db.query('SELECT id FROM businesses WHERE id = 1');
    if (existingBusiness.length === 0) {
      await db.query(`
        INSERT INTO businesses (id, name, nicho, owner_name, email, phone, ai_context)
        VALUES (1, 'Salón Bella Vista', 'salon', 'Carlos García', 'carlos@bellavista.com', '+52 55 1234 5678',
        'Salón de belleza especializado en coloración... Horario: Lun-Sab 9am-7pm.')
      `);
      await db.query("SELECT setval('businesses_id_seq', (SELECT MAX(id) FROM businesses))");

      // Contacts
      const contacts = [
        { name: 'María López', phone: '+52 55 9876 5432', channel: 'whatsapp', stage: 'new', status: 'open', tags: '["lead_caliente"]', notes: 'Interesada en mechas' },
        { name: 'Luis Torres', phone: '+52 55 8765 4321', channel: 'instagram', stage: 'new', status: 'open', tags: '["seguimiento"]', notes: 'Esperando respuesta' },
        { name: 'Juan Pérez', phone: '+52 55 7654 3210', channel: 'whatsapp', stage: 'in_progress', status: 'open', tags: '["cotizacion"]', notes: 'Enviando cotización keratina' },
      ];

      for (let i = 0; i < contacts.length; i++) {
        const c = contacts[i];
        const { rows: contactRows } = await db.query(`
          INSERT INTO contacts (business_id, name, phone, channel, pipeline_stage, status, tags, notes, last_contact_at)
          VALUES (1, $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP - interval '${i * 3 + 1} hours')
          RETURNING id
        `, [c.name, c.phone, c.channel, c.stage, c.status, c.tags, c.notes]);

        const contactId = contactRows[0].id;

        // Conversations + Messages
        const { rows: convRows } = await db.query(`
          INSERT INTO conversations (business_id, contact_id, channel, status, last_message, last_message_at, unread_count)
          VALUES (1, $1, $2, 'open', 'Hola', CURRENT_TIMESTAMP - interval '1 hours', 1)
          RETURNING id
        `, [contactId, c.channel]);

        await db.query(`
          INSERT INTO messages (conversation_id, content, sender, is_ai_generated, created_at)
          VALUES ($1, 'Hola, tengo una consulta', 'client', 0, CURRENT_TIMESTAMP - interval '2 hours')
        `, [convRows[0].id]);
      }

      await db.query(`INSERT INTO quick_replies (business_id, title, content, category) VALUES (1, 'Bienvenida', '¡Hola! 👋 Bienvenido...', 'saludo')`);
      await db.query(`INSERT INTO quick_replies (business_id, title, content, category) VALUES (1, 'Precios mechas', 'Las mechas van desde $1,200...', 'precios')`);
    }

    // ─── Business 2 ────────────────────────────────────────────────────────
    const { rows: existingBusiness2 } = await db.query('SELECT id FROM businesses WHERE id = 2');
    if (existingBusiness2.length === 0) {
      await db.query(`
        INSERT INTO businesses (id, name, nicho, owner_name, email, phone, ai_context)
        VALUES (2, 'Clínica Salud Total', 'clinica', 'Dra. Laura Medina', 'laura@saludtotal.com', '+52 55 2222 3333', 'Clínica de medicina general...')
      `);
      await db.query("SELECT setval('businesses_id_seq', (SELECT MAX(id) FROM businesses))");
    }

    console.log('✅ Seed completado. Base de datos (PostgreSQL) lista.');
  } catch (err) {
    console.error('Seed Error:', err);
  }
}

seed();
