/**
 * copilot.ts — AI Copilot Flotante
 *
 * Agentic endpoint using Anthropic tool use. Claude can call up to 7 tools
 * that query/mutate the business's real data. The tool loop runs server-side
 * in a single HTTP request (max 5 iterations).
 *
 * POST /api/ai/copilot
 *   body:    { messages: [{role, content}] }
 *   returns: { reply, toolsUsed, pendingAction? }
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

// ─── Tool definitions for Claude ─────────────────────────────────────────────

const COPILOT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_stats',
    description: 'Obtiene estadísticas actuales del negocio: total de contactos, conversaciones abiertas, deals por etapa, valor del pipeline, tareas pendientes.',
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month', 'all'],
          description: 'Periodo de tiempo para las estadísticas. Default: "all".',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_contacts',
    description: 'Lista los contactos del negocio. Puede filtrar por etapa del pipeline, canal o búsqueda de texto.',
    input_schema: {
      type: 'object',
      properties: {
        stage: {
          type: 'string',
          enum: ['new', 'contacted', 'in_progress', 'closed', 'lost'],
          description: 'Filtrar por etapa del pipeline.',
        },
        channel: {
          type: 'string',
          enum: ['whatsapp', 'instagram', 'email'],
          description: 'Filtrar por canal de comunicación.',
        },
        search: {
          type: 'string',
          description: 'Buscar por nombre o número de teléfono.',
        },
        limit: {
          type: 'number',
          description: 'Número máximo de resultados. Default: 10.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_pending_followups',
    description: 'Devuelve contactos cuyas conversaciones llevan más de N días sin respuesta del agente. Útil para detectar leads abandonados.',
    input_schema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Mínimo de días sin respuesta. Default: 3.',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados. Default: 10.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_pipeline_summary',
    description: 'Devuelve un resumen del pipeline de ventas: cuántos deals hay en cada etapa y su valor total acumulado.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'search_conversations',
    description: 'Busca conversaciones y mensajes que contengan un texto específico.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Texto a buscar en los mensajes.',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados. Default: 5.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_task',
    description: 'Propone la creación de una tarea de seguimiento. IMPORTANTE: Esta herramienta NO crea la tarea directamente — devuelve los datos para que el usuario confirme antes de guardar.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Título de la tarea. Ej: "Llamar a María López para dar seguimiento".',
        },
        contact_name: {
          type: 'string',
          description: 'Nombre del contacto relacionado (opcional).',
        },
        due_time: {
          type: 'string',
          description: 'Fecha/hora de vencimiento en formato ISO 8601 (opcional).',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'move_contact_stage',
    description: 'Mueve un contacto a una nueva etapa del pipeline. Busca el contacto por nombre o ID.',
    input_schema: {
      type: 'object',
      properties: {
        contact_name: {
          type: 'string',
          description: 'Nombre del contacto (búsqueda parcial).',
        },
        contact_id: {
          type: 'number',
          description: 'ID exacto del contacto (si se conoce).',
        },
        new_stage: {
          type: 'string',
          enum: ['new', 'contacted', 'in_progress', 'closed', 'lost'],
          description: 'Nueva etapa del pipeline.',
        },
      },
      required: ['new_stage'],
    },
  },
  {
    name: 'create_quick_reply',
    description: 'Crea una nueva respuesta rápida de WhatsApp para el negocio. Úsala cuando el dueño pida agregar/crear una respuesta, template o plantilla.',
    input_schema: {
      type: 'object',
      properties: {
        title:    { type: 'string', description: 'Título corto (máx 40 chars)' },
        content:  { type: 'string', description: 'Mensaje completo listo para enviar, puede incluir {{nombre}}' },
        category: { type: 'string', description: 'Categoría: saludo, precios, horarios, politicas, promocion, seguimiento, general' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'update_ai_context',
    description: 'Actualiza el contexto de la IA del negocio. Usa mode=append para agregar info sin borrar lo anterior; mode=replace para reescribir completamente.',
    input_schema: {
      type: 'object',
      properties: {
        new_context: { type: 'string', description: 'Nuevo texto a agregar o reemplazar en el contexto' },
        mode:        { type: 'string', enum: ['append', 'replace'], description: 'append: agrega al final | replace: reemplaza todo' },
      },
      required: ['new_context', 'mode'],
    },
  },
  {
    name: 'add_memory',
    description: 'Guarda un dato importante en la memoria del negocio para que la IA lo recuerde siempre. Se ejecuta automáticamente sin confirmación.',
    input_schema: {
      type: 'object',
      properties: {
        type:    { type: 'string', enum: ['faq', 'style', 'pattern', 'client_insight'], description: 'faq: hecho concreto | style: tono/estilo | pattern: pregunta frecuente | client_insight: insight de clientes' },
        content: { type: 'string', description: 'Contenido claro y específico a recordar' },
      },
      required: ['type', 'content'],
    },
  },
  {
    name: 'create_contact',
    description: 'Agrega un nuevo contacto/lead al CRM.',
    input_schema: {
      type: 'object',
      properties: {
        name:    { type: 'string', description: 'Nombre completo del contacto' },
        phone:   { type: 'string', description: 'Teléfono con código de país, ej: +521234567890' },
        channel: { type: 'string', enum: ['whatsapp', 'instagram', 'email', 'web'], description: 'Canal de origen' },
      },
      required: ['name'],
    },
  },
  {
    name: 'compose_followup',
    description: 'Genera y propone enviar un mensaje de seguimiento personalizado a un contacto que no ha respondido. Muestra el mensaje para que el dueño lo apruebe antes de enviar.',
    input_schema: {
      type: 'object',
      properties: {
        contact_identifier: { type: 'string', description: 'Nombre o teléfono del contacto' },
        context_hint:       { type: 'string', description: 'Contexto extra para personalizar el mensaje (opcional)' },
      },
      required: ['contact_identifier'],
    },
  },
];

// ─── Tool executor ────────────────────────────────────────────────────────────

async function executeTool(
  toolName: string,
  toolInput: Record<string, any>,
  businessId: number,
  anthropic: Anthropic,
): Promise<{ result: any; pendingAction?: any }> {
  switch (toolName) {
    case 'get_stats': {
      const period = toolInput.period || 'all';
      const dateFilter =
        period === 'today'
          ? "AND created_at >= CURRENT_DATE"
          : period === 'week'
            ? "AND created_at >= CURRENT_DATE - INTERVAL '7 days'"
            : period === 'month'
              ? "AND created_at >= CURRENT_DATE - INTERVAL '30 days'"
              : '';

      const [contactsRes, convsRes, dealsRes, tasksRes] = await Promise.all([
        db.query(`SELECT COUNT(*) as total, pipeline_stage FROM contacts WHERE business_id = $1 ${dateFilter} GROUP BY pipeline_stage`, [businessId]),
        db.query(`SELECT COUNT(*) as total, status FROM conversations WHERE business_id = $1 GROUP BY status`, [businessId]),
        db.query(`SELECT COUNT(*) as count, stage, SUM(value) as total_value FROM pipeline_deals WHERE business_id = $1 GROUP BY stage`, [businessId]),
        db.query(`SELECT COUNT(*) as total, status FROM tasks WHERE business_id = $1 GROUP BY status`, [businessId]),
      ]);

      return {
        result: {
          contacts: contactsRes.rows,
          conversations: convsRes.rows,
          pipeline_deals: dealsRes.rows,
          tasks: tasksRes.rows,
        },
      };
    }

    case 'get_contacts': {
      const { stage, channel, search, limit = 10 } = toolInput;
      let query = 'SELECT id, name, phone, email, channel, pipeline_stage, last_contact_at FROM contacts WHERE business_id = $1';
      const params: any[] = [businessId];
      let paramIdx = 2;

      if (stage) { query += ` AND pipeline_stage = $${paramIdx++}`; params.push(stage); }
      if (channel) { query += ` AND channel = $${paramIdx++}`; params.push(channel); }
      if (search) { query += ` AND (name ILIKE $${paramIdx} OR phone ILIKE $${paramIdx})`; params.push(`%${search}%`); paramIdx++; }

      query += ` ORDER BY last_contact_at DESC LIMIT $${paramIdx}`;
      params.push(Math.min(limit, 20));

      const { rows } = await db.query(query, params);
      return { result: { contacts: rows, count: rows.length } };
    }

    case 'get_pending_followups': {
      const { days = 3, limit = 10 } = toolInput;
      const { rows } = await db.query(
        `SELECT ct.id, ct.name, ct.phone, ct.channel, ct.pipeline_stage,
                cv.last_message_at,
                EXTRACT(DAY FROM NOW() - cv.last_message_at)::int AS days_without_reply
         FROM conversations cv
         JOIN contacts ct ON ct.id = cv.contact_id
         WHERE cv.business_id = $1
           AND cv.status = 'open'
           AND cv.last_message_at < NOW() - ($2 * INTERVAL '1 day')
         ORDER BY cv.last_message_at ASC
         LIMIT $3`,
        [businessId, days, Math.min(limit, 20)],
      );
      return { result: { contacts: rows, count: rows.length, filter_days: days } };
    }

    case 'get_pipeline_summary': {
      const { rows } = await db.query(
        `SELECT stage,
                COUNT(*) as count,
                COALESCE(SUM(value), 0) as total_value
         FROM pipeline_deals
         WHERE business_id = $1
         GROUP BY stage
         ORDER BY CASE stage
           WHEN 'new' THEN 1
           WHEN 'contacted' THEN 2
           WHEN 'in_progress' THEN 3
           WHEN 'closed' THEN 4
           WHEN 'lost' THEN 5
           ELSE 6 END`,
        [businessId],
      );
      const totalValue = rows.reduce((sum: number, r: any) => sum + Number(r.total_value), 0);
      return { result: { stages: rows, total_pipeline_value: totalValue } };
    }

    case 'search_conversations': {
      const { query, limit = 5 } = toolInput;
      const { rows } = await db.query(
        `SELECT DISTINCT cv.id as conversation_id, ct.name as contact_name,
                ct.channel, m.content as matching_message, m.created_at
         FROM messages m
         JOIN conversations cv ON cv.id = m.conversation_id
         JOIN contacts ct ON ct.id = cv.contact_id
         WHERE cv.business_id = $1 AND m.content ILIKE $2
         ORDER BY m.created_at DESC
         LIMIT $3`,
        [businessId, `%${query}%`, Math.min(limit, 10)],
      );
      return { result: { conversations: rows, count: rows.length } };
    }

    case 'create_task': {
      // Does NOT insert — returns pending action for frontend confirmation
      const { title, contact_name, due_time } = toolInput;
      return {
        result: {
          status: 'pending_confirmation',
          message: 'Tarea lista para crear. El usuario debe confirmar antes de guardar.',
        },
        pendingAction: {
          action: 'create_task',
          data: { title, contact_name, due_time: due_time || null },
          requiresConfirm: true,
        },
      };
    }

    case 'move_contact_stage': {
      const { contact_name, contact_id, new_stage } = toolInput;
      let id = contact_id;

      if (!id && contact_name) {
        const { rows } = await db.query(
          'SELECT id, name FROM contacts WHERE business_id = $1 AND name ILIKE $2 LIMIT 1',
          [businessId, `%${contact_name}%`],
        );
        if (rows.length === 0) {
          return { result: { error: `No se encontró un contacto con el nombre "${contact_name}"` } };
        }
        id = rows[0].id;
      }

      if (!id) return { result: { error: 'Se requiere contact_name o contact_id' } };

      await db.query(
        'UPDATE contacts SET pipeline_stage = $1 WHERE id = $2 AND business_id = $3',
        [new_stage, id, businessId],
      );

      return { result: { success: true, contact_id: id, new_stage } };
    }

    case 'create_quick_reply': {
      const { title, content, category } = toolInput;
      return {
        result: {
          status: 'pending_confirmation',
          message: `Respuesta rápida "${title}" lista para crear. Pendiente de confirmación del usuario.`,
        },
        pendingAction: {
          action: 'create_quick_reply',
          data: { title, content, category: category || 'general' },
          requiresConfirm: true,
        },
      };
    }

    case 'update_ai_context': {
      const { rows: bizCtxRows } = await db.query('SELECT ai_context FROM businesses WHERE id=$1', [businessId]);
      const currentCtx = bizCtxRows[0]?.ai_context || '';
      const preview = toolInput.mode === 'append'
        ? (currentCtx ? currentCtx + '\n\n' + toolInput.new_context : toolInput.new_context)
        : toolInput.new_context;
      return {
        result: {
          status: 'pending_confirmation',
          message: `Contexto de IA listo para actualizar (modo: ${toolInput.mode}). Pendiente de confirmación.`,
        },
        pendingAction: {
          action: 'update_ai_context',
          data: { preview, mode: toolInput.mode, new_context: toolInput.new_context },
          requiresConfirm: true,
        },
      };
    }

    case 'add_memory': {
      await storeMemory(businessId, toolInput.type, toolInput.content, 'auto_learned', 8);
      return { result: { status: 'saved', type: toolInput.type, content: toolInput.content } };
    }

    case 'create_contact': {
      const { name, phone, channel } = toolInput;
      return {
        result: {
          status: 'pending_confirmation',
          message: `Contacto "${name}" listo para agregar al CRM. Pendiente de confirmación.`,
        },
        pendingAction: {
          action: 'create_contact',
          data: { title: name, phone: phone || null, channel: channel || 'whatsapp' },
          requiresConfirm: true,
        },
      };
    }

    case 'compose_followup': {
      const { contact_identifier, context_hint } = toolInput;
      // Find open conversation for this contact
      const { rows: ctRows } = await db.query(
        `SELECT ct.id, ct.name, c.id as conv_id, c.last_message_at,
                EXTRACT(EPOCH FROM (NOW() - c.last_message_at)) / 3600 AS hours_silent
         FROM contacts ct
         JOIN conversations c ON c.contact_id = ct.id
         WHERE c.business_id = $1
           AND (ct.name ILIKE $2 OR ct.phone LIKE $2)
           AND c.status = 'open'
         ORDER BY c.last_message_at ASC LIMIT 1`,
        [businessId, `%${contact_identifier}%`],
      );
      if (ctRows.length === 0) {
        return { result: { error: `No se encontró conversación abierta para "${contact_identifier}"` } };
      }

      const conv = ctRows[0];
      const { rows: msgRows } = await db.query(
        `SELECT sender, content FROM messages WHERE conversation_id=$1 ORDER BY created_at ASC`,
        [conv.conv_id],
      );
      const { rows: bizRows2 } = await db.query(
        'SELECT name, nicho, ai_context FROM businesses WHERE id=$1',
        [businessId],
      );
      const biz = bizRows2[0];
      const transcript = msgRows.slice(-8).map((m: any) =>
        `${m.sender === 'client' ? conv.name : biz.name}: ${m.content}`,
      ).join('\n');
      const hoursSilent = Number(conv.hours_silent);
      const silenceLabel = hoursSilent >= 24
        ? `${Math.floor(hoursSilent / 24)} día(s)` : `${Math.floor(hoursSilent)} hora(s)`;

      const followupResp = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        temperature: 0.7,
        system: `Genera UN mensaje de seguimiento para ${conv.name} de "${biz.name}" (${biz.nicho || 'general'}). Lleva ${silenceLabel} sin responder.${context_hint ? ` Contexto extra: ${context_hint}` : ''} Solo el mensaje, 2-3 líneas, cálido.${biz.ai_context ? `\n${biz.ai_context}` : ''}`,
        messages: [{ role: 'user', content: transcript ? `Historial:\n${transcript}` : '(Sin historial previo)' }],
      });
      const msgText = (followupResp.content.find((c: any) => c.type === 'text') as any)?.text?.trim() || '';

      return {
        result: {
          status: 'pending_confirmation',
          message: `Mensaje de seguimiento generado para ${conv.name}. Pendiente de confirmación antes de enviar.`,
          generated_message: msgText,
        },
        pendingAction: {
          action: 'compose_followup',
          data: { conversation_id: conv.conv_id, contact_name: conv.name, message: msgText },
          requiresConfirm: true,
        },
      };
    }

    default:
      return { result: { error: `Tool "${toolName}" not implemented` } };
  }
}

// ─── Main route ───────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const user = (req as any).user;
    const businessId: number = user?.business_id;

    if (!businessId || businessId === 0) {
      return res.status(400).json({ error: 'No business configured yet' });
    }

    const { messages } = req.body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }

    // Load business context for system prompt
    const { rows: bizRows } = await db.query(
      'SELECT name, nicho, ai_context FROM businesses WHERE id = $1',
      [businessId],
    );

    const biz = bizRows[0] || { name: 'tu negocio', nicho: 'general', ai_context: '' };

    const NICHO_LABELS: Record<string, string> = {
      salon: 'salón de belleza', barberia: 'barbería', clinica: 'clínica',
      inmobiliaria: 'inmobiliaria', restaurante: 'restaurante', academia: 'academia',
      taller: 'taller mecánico', courier: 'courier', agencia_ia: 'agencia de IA',
    };

    const systemPrompt = `Eres el Copilot de ClienteLoop para "${biz.name}" (${NICHO_LABELS[biz.nicho] || biz.nicho}).
Eres el asistente ejecutivo inteligente del dueño — su mano derecha dentro del CRM.
Tienes acceso a los datos reales del negocio a través de herramientas.

PERSONALIDAD Y ESTILO:
- Eres conversacional, cálido y directo — como un socio de confianza, no un bot rígido.
- Adapta la longitud de tu respuesta a la complejidad de la pregunta: breve para cosas simples, detallado cuando el análisis lo requiere.
- Usa lenguaje natural en español. Puedes usar emojis ocasionalmente si encajan con el tono.
- Cuando ejecutes herramientas, menciona brevemente qué estás consultando para que el dueño sepa qué está pasando.
- Sé proactivo: si encuentras algo relevante al responder, menciónalo aunque no te lo hayan pedido explícitamente.

DATOS Y HERRAMIENTAS:
- Usa herramientas SIEMPRE para obtener datos reales. NUNCA inventes números, nombres o estadísticas.
- Incluye nombres reales de contactos en tus respuestas cuando sea relevante — hacen la respuesta útil.
- Para add_memory: se guarda automáticamente, confirma al dueño con un ✅ que quedó en la memoria.
- Para compose_followup: busca al contacto, genera el mensaje y preséntalo para que el dueño lo apruebe antes de enviar.
- Para acciones con consecuencias (enviar mensajes, modificar contexto IA, agregar contactos): siempre pide confirmación.

LO QUE PUEDES HACER:
- Consultar stats, leads, pipeline, conversaciones y tareas pendientes
- Mover leads entre etapas del pipeline
- Crear tareas de seguimiento
- Crear respuestas rápidas de WhatsApp listas para usar
- Actualizar o ampliar el contexto de tu IA (lo que el asistente sabe del negocio)
- Guardar memorias importantes (precios, políticas, insights de clientes)
- Agregar nuevos contactos al CRM
- Redactar y proponer mensajes de seguimiento personalizados

LO QUE NO PUEDES HACER (sé transparente sobre esto):
- Acceder a internet, redes sociales ni datos externos al CRM
- Eliminar registros o datos de forma permanente
- Modificar configuraciones de facturación o permisos de usuarios
- Enviar mensajes sin que el dueño confirme primero
- Ver conversaciones de otros negocios
- Si una solicitud está fuera de tus capacidades, explícalo con claridad y sugiere la alternativa más cercana dentro del CRM.

${biz.ai_context ? `Contexto del negocio:\n${biz.ai_context}` : ''}`;

    const anthropic = getClient();
    let loopMessages: Anthropic.MessageParam[] = messages as Anthropic.MessageParam[];
    const toolsUsed: string[] = [];
    let pendingAction: any = null;
    let finalReply = '';

    // ── Agentic loop (max 5 tool call iterations) ──────────────────────────
    for (let i = 0; i < 5; i++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: systemPrompt,
        tools: COPILOT_TOOLS,
        messages: loopMessages,
      });

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find((c) => c.type === 'text');
        finalReply = textBlock ? (textBlock as any).text : '';
        break;
      }

      if (response.stop_reason === 'tool_use') {
        // Build tool results
        const toolResultContents: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;

          toolsUsed.push(block.name);
          console.log(`[Copilot] Tool call: ${block.name}`, block.input);

          try {
            const { result, pendingAction: pa } = await executeTool(
              block.name,
              block.input as Record<string, any>,
              businessId,
              anthropic,
            );

            if (pa) pendingAction = pa;

            toolResultContents.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          } catch (err: any) {
            console.error(`[Copilot] Tool error (${block.name}):`, err);
            toolResultContents.push({
              type: 'tool_result',
              tool_use_id: block.id,
              is_error: true,
              content: `Error al ejecutar ${block.name}: ${err.message}`,
            });
          }
        }

        // Append assistant + tool results and loop
        loopMessages = [
          ...loopMessages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResultContents },
        ];
        continue;
      }

      // Unexpected stop reason — break
      break;
    }

    if (!finalReply) {
      finalReply = 'No pude generar una respuesta. Intenta de nuevo.';
    }

    res.json({ reply: finalReply, toolsUsed, pendingAction });
  } catch (err: any) {
    console.error('[Copilot]', err);
    res.status(500).json({ error: err.message || 'Error in copilot' });
  }
});

export default router;
