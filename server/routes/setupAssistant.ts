/**
 * setupAssistant.ts — Agentic Onboarding Assistant
 *
 * Two endpoints:
 *  POST /chat     — Conversational turn with the setup AI consultant
 *  POST /finalize — Executes 3 agentic actions from the full conversation:
 *                   1. Save extracted facts as business_memories
 *                   2. Generate and save 5 custom quick replies
 *                   3. Update businesses.ai_context with structured summary
 */

import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import db from '../db/database.js';
import { storeMemory } from '../lib/agent-memory.js';

const router = Router();

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ─── POST /chat ───────────────────────────────────────────────────────────────
// Handles one conversation turn with the setup consultant AI.

router.post('/chat', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { messages } = req.body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }
    // Empty array is valid — means the assistant should send the opening greeting

    // Load business info for personalization
    const { rows: bizRows } = await db.query(
      'SELECT name, nicho FROM businesses WHERE supabase_user_id = $1 LIMIT 1',
      [userId],
    );

    const biz = bizRows[0] || { name: 'tu negocio', nicho: 'general' };

    const NICHO_LABELS: Record<string, string> = {
      salon: 'salón de belleza',
      barberia: 'barbería',
      clinica: 'clínica / consultorio',
      inmobiliaria: 'inmobiliaria',
      restaurante: 'restaurante',
      academia: 'academia / centro educativo',
      taller: 'taller mecánico',
      courier: 'courier / mensajería',
      agencia_ia:   'agencia de IA',
      vidrieria:    'vidriería / cristalería',
      carpinteria:  'carpintería y ebanistería',
      construccion: 'construcción y remodelación',
    };

    const nichoLabel = NICHO_LABELS[biz.nicho] || biz.nicho;

    const systemPrompt = `Eres el Asistente de Configuración de ClienteLoop para "${biz.name}" (${nichoLabel}).
Tu misión: hacer una entrevista conversacional, amigable y rápida para configurar automáticamente el asistente de IA del negocio.

Extrae en este orden exacto (UNA pregunta a la vez):
1. Sus 3–5 productos o servicios principales con precios exactos
2. Políticas: pagos, envío o delivery, cancelaciones, garantías
3. Tono de comunicación: ¿formal, amigable, relajado, juvenil?
4. Cualquier promoción activa o dato especial que el asistente deba conocer

Reglas:
- Haz UNA sola pregunta por respuesta tuya.
- Sé conversacional y cálido, usa emojis ocasionalmente.
- Cuando hayas cubierto los 4 puntos (mínimo 4 intercambios del usuario), ofrece finalizar así:
  "¡Perfecto, ya tengo todo lo que necesito! 🎉 ¿Configuro tu asistente ahora con esta información?"
- Si el usuario dice que sí o acepta, responde ÚNICAMENTE con el texto exacto: SETUP_COMPLETE
- No respondas nada más después de SETUP_COMPLETE.`;

    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find((c) => c.type === 'text');
    const reply = textBlock ? textBlock.text.trim() : '';
    const setupComplete = reply === 'SETUP_COMPLETE';

    res.json({ reply, setupComplete });
  } catch (err: any) {
    console.error('[SetupAssistant /chat]', err);
    res.status(500).json({ error: err.message || 'Error in setup chat' });
  }
});

// ─── POST /finalize ───────────────────────────────────────────────────────────
// Takes the full conversation and executes 3 agentic actions in parallel.

router.post('/finalize', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { messages } = req.body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    if (!messages || messages.length < 2) {
      return res.status(400).json({ error: 'messages array required' });
    }

    // Load business
    const { rows: bizRows } = await db.query(
      'SELECT id, name, nicho FROM businesses WHERE supabase_user_id = $1 LIMIT 1',
      [userId],
    );

    if (bizRows.length === 0) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const biz = bizRows[0];
    const businessId = biz.id;
    const anthropic = getClient();

    // Build a plain transcript for extraction prompts
    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'Dueño' : 'Asistente'}: ${m.content}`)
      .join('\n');

    // ── Action 1: Extract and store memories ──────────────────────────────────
    const memoriesExtraction = anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      temperature: 0,
      system: `Analiza la siguiente entrevista de configuración de negocio y extrae datos estructurados en JSON.
Devuelve ÚNICAMENTE JSON válido con esta estructura exacta (sin texto adicional):
{
  "faqs": ["string", ...],
  "style": "string",
  "patterns": ["string", ...]
}

- faqs: lista de hechos concretos (precios, servicios, políticas). Ej: "Corte de cabello cuesta $300"
- style: UNA descripción del tono/estilo del negocio. Ej: "Amigable y cercano, usa lenguaje informal"
- patterns: preguntas frecuentes anticipadas. Ej: "¿Cuánto cuesta el tinte?"`,
      messages: [{ role: 'user', content: `Entrevista:\n${transcript}` }],
    });

    // ── Action 2: Generate quick replies ─────────────────────────────────────
    const quickRepliesExtraction = anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      temperature: 0,
      system: `Analiza la siguiente entrevista y genera EXACTAMENTE 5 respuestas rápidas de WhatsApp para el negocio.
Usa los precios, servicios y tono reales de la entrevista.
Devuelve ÚNICAMENTE JSON válido (sin texto adicional):
[
  { "title": "string (máx 40 chars)", "category": "string", "content": "string (mensaje completo listo para enviar)" },
  ...
]
Categorías sugeridas: precios, saludo, horarios, politicas, promocion
Incluye {{nombre}} donde sea natural dirigirse al cliente.`,
      messages: [{ role: 'user', content: `Entrevista:\n${transcript}` }],
    });

    // ── Action 3: Generate structured ai_context ──────────────────────────────
    const contextExtraction = anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      temperature: 0,
      system: `Analiza la siguiente entrevista y genera un "Contexto de IA" estructurado para el negocio.
Este texto será inyectado en el system prompt del asistente de WhatsApp.
Escríbelo en tercera persona, directo y denso en información útil.
Formato:
SERVICIOS Y PRECIOS: [lista concisa]
POLÍTICAS: [resumen de políticas]
TONO: [descripción del estilo]
DATOS ESPECIALES: [promociones u otra info relevante]
Máximo 250 palabras. Solo el texto, sin JSON.`,
      messages: [{ role: 'user', content: `Entrevista:\n${transcript}` }],
    });

    // Wait for all 3 extractions in parallel
    const [memoriesResult, quickRepliesResult, contextResult] = await Promise.all([
      memoriesExtraction,
      quickRepliesExtraction,
      contextExtraction,
    ]);

    let memoriesCreated = 0;
    let quickRepliesCreated = 0;
    let contextUpdated = false;

    // ── Save memories ─────────────────────────────────────────────────────────
    try {
      const memoriesText = (memoriesResult.content.find((c) => c.type === 'text') as any)?.text || '';
      // Strip potential markdown code fences
      const jsonStr = memoriesText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const extracted = JSON.parse(jsonStr);

      const savePromises: Promise<void>[] = [];

      if (Array.isArray(extracted.faqs)) {
        for (const faq of extracted.faqs) {
          if (typeof faq === 'string' && faq.trim()) {
            savePromises.push(storeMemory(businessId, 'faq', faq.trim(), 'auto_learned', 8));
            memoriesCreated++;
          }
        }
      }
      if (typeof extracted.style === 'string' && extracted.style.trim()) {
        savePromises.push(storeMemory(businessId, 'style', extracted.style.trim(), 'auto_learned', 9));
        memoriesCreated++;
      }
      if (Array.isArray(extracted.patterns)) {
        for (const pattern of extracted.patterns) {
          if (typeof pattern === 'string' && pattern.trim()) {
            savePromises.push(storeMemory(businessId, 'pattern', pattern.trim(), 'auto_learned', 7));
            memoriesCreated++;
          }
        }
      }
      await Promise.all(savePromises);
    } catch (err) {
      console.error('[SetupAssistant /finalize] Memory extraction error:', err);
    }

    // ── Save quick replies ────────────────────────────────────────────────────
    try {
      const qrText = (quickRepliesResult.content.find((c) => c.type === 'text') as any)?.text || '';
      const jsonStr = qrText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const quickReplies: Array<{ title: string; category: string; content: string }> = JSON.parse(jsonStr);

      for (const qr of quickReplies) {
        if (qr.title && qr.content) {
          await db.query(
            'INSERT INTO quick_replies (business_id, title, content, category) VALUES ($1, $2, $3, $4)',
            [businessId, qr.title.substring(0, 100), qr.content, qr.category || 'general'],
          );
          quickRepliesCreated++;
        }
      }
    } catch (err) {
      console.error('[SetupAssistant /finalize] Quick replies extraction error:', err);
    }

    // ── Update ai_context ─────────────────────────────────────────────────────
    try {
      const contextText = (contextResult.content.find((c) => c.type === 'text') as any)?.text || '';
      if (contextText.trim()) {
        await db.query(
          'UPDATE businesses SET ai_context = $1 WHERE id = $2',
          [contextText.trim(), businessId],
        );
        contextUpdated = true;
      }
    } catch (err) {
      console.error('[SetupAssistant /finalize] Context update error:', err);
    }

    console.log(`[SetupAssistant] Business ${businessId} setup complete — memories: ${memoriesCreated}, qr: ${quickRepliesCreated}, context: ${contextUpdated}`);

    res.json({ memoriesCreated, quickRepliesCreated, contextUpdated });
  } catch (err: any) {
    console.error('[SetupAssistant /finalize]', err);
    res.status(500).json({ error: err.message || 'Error finalizing setup' });
  }
});

export default router;
