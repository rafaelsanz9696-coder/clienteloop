import 'dotenv/config';
import db from './database.js';

async function fixUserDb() {
    try {
        // 1. Give AI Context to the Barbershop business
        await db.query(`
      UPDATE businesses 
      SET ai_context = 'Eres un recepcionista experto para una barbería. Responde siempre con amabilidad, sé conciso y busca agendar citas.' 
      WHERE id = 1
    `);

        // 2. Link the WhatsApp phone number to this business
        await db.query(`
      INSERT INTO channel_numbers (business_id, channel, identifier) 
      VALUES (1, 'whatsapp', '1000177549846403') 
      ON CONFLICT DO NOTHING
    `);

        // 3. Add Quick Replies
        await db.query(`
      INSERT INTO quick_replies (business_id, title, content, category) 
      VALUES 
      (1, 'Bienvenida', '¡Hola! 👋 Bienvenido a la barbería, ¿en qué te puedo ayudar hoy?', 'saludo'),
      (1, 'Precios', 'Nuestros cortes clásicos están en $15 y con barba (Toalla caliente) en $20.', 'precios'),
      (1, 'Horarios', 'Estamos abiertos de Lunes a Sábado de 9:00 AM a 8:00 PM.', 'horario')
    `);

        console.log('✅ Base de datos configurada con éxito para el negocio 1');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

fixUserDb();
