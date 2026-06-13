/**
 * copilot.ts — AI Copilot Flotante using Google Gemini
 */

import { Router } from 'express';
import db from '../db/database.js';
import { storeMemory, type MemoryType } from '../lib/agent-memory.js';
import { geminiRequest, geminiStream } from '../lib/gemini.js';

const router = Router();

// ─── Tool definitions for Gemini ─────────────────────────────────────────────

const COPILOT_TOOLS = [
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
    name: 'setup_business_knowledge',
    description: 'Configura el conocimiento del negocio EN BLOQUE a partir de información que el dueño pega en el chat (prompt de negocio, lista de precios, servicios, políticas, horarios). Guarda múltiples memorias, actualiza el contexto de la IA y crea respuestas rápidas en UNA sola operación. Úsala SIEMPRE que el dueño pegue un texto largo con información de su negocio — NO uses add_memory repetidamente para eso.',
    input_schema: {
      type: 'object',
      properties: {
        memories: {
          type: 'array',
          description: 'Datos atómicos a memorizar. Un dato por memoria: cada precio, cada servicio, cada política, cada horario por separado.',
          items: {
            type: 'object',
            properties: {
              type:    { type: 'string', enum: ['faq', 'style', 'pattern', 'client_insight'], description: 'faq: hecho concreto (precios, servicios, políticas) | style: tono/estilo | pattern: pregunta frecuente | client_insight: insight de clientes' },
              content: { type: 'string', description: 'Dato claro y autocontenido, ej: "Envío a Cuba 1-10 lb: $8/lb"' },
            },
            required: ['type', 'content'],
          },
        },
        ai_context: {
          type: 'string',
          description: 'Resumen completo y bien redactado del negocio para el cerebro de la IA: qué hace, servicios, precios clave, políticas, tono. Escríbelo como instrucciones para un asistente.',
        },
        ai_context_mode: {
          type: 'string',
          enum: ['append', 'replace'],
          description: 'replace si el dueño está configurando desde cero o pegó su prompt completo; append si solo agrega info nueva',
        },
        quick_replies: {
          type: 'array',
          description: 'Respuestas rápidas de WhatsApp útiles derivadas de la info (opcional, máx 6)',
          items: {
            type: 'object',
            properties: {
              title:    { type: 'string', description: 'Título corto (máx 40 chars)' },
              content:  { type: 'string', description: 'Mensaje listo para enviar, puede incluir {{nombre}}' },
              category: { type: 'string', description: 'saludo, precios, horarios, politicas, promocion, seguimiento, general' },
            },
            required: ['title', 'content'],
          },
        },
      },
      required: ['memories'],
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
                SUM(value) as total_value
         FROM pipeline_deals
         WHERE business_id = $1
         GROUP BY stage`,
        [businessId]
      );
      return { result: { summary: rows } };
    }

    case 'search_conversations': {
      const { query: searchVal, limit = 5 } = toolInput;
      const { rows } = await db.query(
        `SELECT m.id, m.content, m.sender, m.created_at, c.id as conversation_id, ct.name as contact_name
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         JOIN contacts ct ON ct.id = c.contact_id
         WHERE c.business_id = $1 AND m.content ILIKE $2
         ORDER BY m.created_at DESC LIMIT $3`,
        [businessId, `%${searchVal}%`, Math.min(limit, 10)]
      );
      return { result: { matches: rows, count: rows.length } };
    }

    case 'create_task': {
      const { title, contact_name, due_time } = toolInput;
      let contactId: number | null = null;

      if (contact_name) {
        const { rows } = await db.query(
          'SELECT id FROM contacts WHERE business_id = $1 AND name ILIKE $2 LIMIT 1',
          [businessId, `%${contact_name}%`]
        );
        if (rows[0]) contactId = rows[0].id;
      }

      return {
        result: {
          status: 'pending_confirmation',
          message: `Tarea "${title}" lista para crear. Pendiente de confirmación.`,
        },
        pendingAction: {
          action: 'create_task',
          data: { title, contact_id: contactId, due_time: due_time || null },
          requiresConfirm: true,
        },
      };
    }

    case 'move_contact_stage': {
      const { contact_name, contact_id, new_stage } = toolInput;
      let cId = contact_id;

      if (!cId && contact_name) {
        const { rows } = await db.query(
          'SELECT id FROM contacts WHERE business_id = $1 AND name ILIKE $2 LIMIT 1',
          [businessId, `%${contact_name}%`]
        );
        cId = rows[0]?.id;
      }

      if (!cId) {
        return { result: { error: `No se pudo encontrar un contacto con el nombre "${contact_name}"` } };
      }

      return {
        result: {
          status: 'pending_confirmation',
          message: `Contacto con ID ${cId} listo para mover a "${new_stage}". Pendiente de confirmación.`,
        },
        pendingAction: {
          action: 'move_contact_stage',
          data: { contact_id: cId, stage: new_stage },
          requiresConfirm: true,
        },
      };
    }

    case 'create_quick_reply': {
      const { title, content, category } = toolInput;
      return {
        result: {
          status: 'pending_confirmation',
          message: `Plantilla de respuesta rápida "${title}" lista para crear. Pendiente de confirmación.`,
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

    case 'setup_business_knowledge': {
      const memories: Array<{ type: string; content: string }> = Array.isArray(toolInput.memories)
        ? toolInput.memories
        : [];
      const validTypes: MemoryType[] = ['faq', 'style', 'pattern', 'client_insight'];

      let savedMemories = 0;
      for (const m of memories) {
        if (!m?.content) continue;
        const type: MemoryType = validTypes.includes(m.type as MemoryType) ? (m.type as MemoryType) : 'faq';
        await storeMemory(businessId, type, m.content, 'manual', 9);
        savedMemories++;
      }

      let contextUpdated = false;
      if (toolInput.ai_context) {
        if (toolInput.ai_context_mode === 'append') {
          const { rows } = await db.query('SELECT ai_context FROM businesses WHERE id=$1', [businessId]);
          const current = rows[0]?.ai_context || '';
          await db.query('UPDATE businesses SET ai_context=$1 WHERE id=$2', [
            current ? current + '\n\n' + toolInput.ai_context : toolInput.ai_context,
            businessId,
          ]);
        } else {
          await db.query('UPDATE businesses SET ai_context=$1 WHERE id=$2', [toolInput.ai_context, businessId]);
        }
        contextUpdated = true;
      }

      let createdReplies = 0;
      const quickReplies: Array<{ title: string; content: string; category?: string }> = Array.isArray(toolInput.quick_replies)
        ? toolInput.quick_replies.slice(0, 6)
        : [];
      for (const qr of quickReplies) {
        if (!qr?.title || !qr?.content) continue;
        await db.query(
          'INSERT INTO quick_replies (business_id, title, content, category) VALUES ($1, $2, $3, $4)',
          [businessId, qr.title.slice(0, 40), qr.content, qr.category || 'general'],
        );
        createdReplies++;
      }

      return {
        result: {
          status: 'configured',
          memories_saved: savedMemories,
          ai_context_updated: contextUpdated,
          quick_replies_created: createdReplies,
        },
      };
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

      const followupResp = await geminiRequest({
        model: 'gemini-3.5-flash',
        temperature: 0.7,
        maxTokens: 200,
        systemPrompt: `Genera UN mensaje de seguimiento para ${conv.name} de "${biz.name}" (${biz.nicho || 'general'}). Lleva ${silenceLabel} sin responder.${context_hint ? ` Contexto extra: ${context_hint}` : ''} Solo el mensaje, 2-3 líneas, cálido.${biz.ai_context ? `\n${biz.ai_context}` : ''}`,
        messages: [{ role: 'user', content: transcript ? `Historial:\n${transcript}` : '(Sin historial previo)' }],
      });
      const msgText = followupResp.text?.trim() || '';

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

// ─── System prompt builder ────────────────────────────────────────────────────

const NICHO_LABELS: Record<string, string> = {
  salon: 'salón de belleza', barberia: 'barbería', clinica: 'clínica',
  inmobiliaria: 'inmobiliaria', restaurante: 'restaurante', academia: 'academia',
  taller: 'taller mecánico', courier: 'courier', agencia_ia: 'agencia de IA',
};

function buildSystemPrompt(biz: { name: string; nicho: string; ai_context?: string }): string {
  return `Eres el Copilot de ClienteLoop para "${biz.name}" (${NICHO_LABELS[biz.nicho] || biz.nicho}).
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

CONFIGURACIÓN DEL NEGOCIO POR CHAT (muy importante):
- Si el dueño pega un texto largo con información de su negocio (un prompt que tenía guardado, lista de precios, servicios, políticas, horarios), usa setup_business_knowledge para configurarlo TODO en una sola operación.
- Extrae cada dato como una memoria atómica y separada: cada precio es una memoria, cada servicio es una memoria, cada política es una memoria. Sé exhaustivo — no resumas ni omitas precios.
- Redacta también el ai_context: un resumen completo del negocio escrito como instrucciones para el asistente que responde a los clientes (usa mode=replace si es la configuración inicial o el dueño pegó su prompt completo).
- Genera 3-6 respuestas rápidas útiles a partir de la info (saludo, precios, horarios...).
- Al terminar, muestra un resumen claro de lo que aprendiste: cuántas memorias, qué contexto quedó, qué respuestas rápidas creaste. Pregunta si falta algo.
- Este flujo NO requiere confirmación previa: la información viene del dueño textualmente.

LO QUE PUEDES HACER:
- Consultar stats, leads, pipeline, conversaciones y tareas pendientes
- Mover leads entre etapas del pipeline
- Crear tareas de seguimiento
- Crear respuestas rápidas de WhatsApp listas para usar
- Actualizar o ampliar el contexto de tu IA (lo que el asistente sabe del negocio)
- Guardar memorias importantes (precios, políticas, insights de clientes)
- Configurar el negocio completo desde un texto pegado (prompt, precios, servicios) con setup_business_knowledge
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
}

// ─── Main route (non-streaming) ───────────────────────────────────────────────

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
    const systemPrompt = buildSystemPrompt(biz);

    let loopMessages: any[] = [...messages];
    const toolsUsed: string[] = [];
    let pendingAction: any = null;
    let finalReply = '';

    // Agentic loop (max 5 tool call iterations)
    for (let i = 0; i < 5; i++) {
      const response = await geminiRequest({
        model: 'gemini-3.5-flash',
        systemPrompt,
        messages: loopMessages,
        tools: COPILOT_TOOLS,
      });

      if (!response.toolCalls) {
        finalReply = response.text || '';
        break;
      }

      // We have tool calls! Run them
      const toolResultContents: any[] = [];
      const toolCallContent: any[] = [];

      for (const tc of response.toolCalls) {
        toolsUsed.push(tc.name);
        console.log(`[Copilot Gemini] Tool call: ${tc.name}`, tc.args);

        try {
          const { result, pendingAction: pa } = await executeTool(
            tc.name,
            tc.args,
            businessId,
          );

          if (pa) pendingAction = pa;

          toolCallContent.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.args,
            thoughtSignature: tc.thoughtSignature,
          });

          toolResultContents.push({
            type: 'tool_result',
            tool_use_id: tc.id,
            name: tc.name,
            content: result,
          });
        } catch (err: any) {
          console.error(`[Copilot Gemini] Tool error (${tc.name}):`, err);
          toolCallContent.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.args,
          });

          toolResultContents.push({
            type: 'tool_result',
            tool_use_id: tc.id,
            name: tc.name,
            is_error: true,
            content: `Error al ejecutar ${tc.name}: ${err.message}`,
          });
        }
      }

      // Append tool calls & results and loop
      loopMessages = [
        ...loopMessages,
        { role: 'assistant', content: toolCallContent },
        { role: 'user', content: toolResultContents },
      ];
    }

    if (!finalReply) {
      finalReply = 'No pude generar una respuesta. Intenta de nuevo.';
    }

    res.json({ reply: finalReply, toolsUsed, pendingAction });
  } catch (err: any) {
    console.error('[Copilot Gemini]', err);
    res.status(500).json({ error: err.message || 'Error in copilot' });
  }
});

// ─── Streaming route (SSE) ────────────────────────────────────────────────────

router.post('/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data: object) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const user = (req as any).user;
    const businessId: number = user?.business_id;

    if (!businessId || businessId === 0) {
      send({ type: 'error', message: 'No business configured yet' });
      return res.end();
    }

    const { messages } = req.body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      send({ type: 'error', message: 'messages array required' });
      return res.end();
    }

    const { rows: bizRows } = await db.query(
      'SELECT name, nicho, ai_context FROM businesses WHERE id = $1',
      [businessId],
    );
    const biz = bizRows[0] || { name: 'tu negocio', nicho: 'general', ai_context: '' };
    const systemPrompt = buildSystemPrompt(biz);

    let loopMessages: any[] = [...messages];
    const toolsUsed: string[] = [];
    let pendingAction: any = null;
    let accumulatedReply = '';

    for (let i = 0; i < 5; i++) {
      let currentToolCalls: any[] = [];
      accumulatedReply = ''; // Reset reply text for this turn

      await geminiStream({
        model: 'gemini-3.5-flash',
        systemPrompt,
        messages: loopMessages,
        tools: COPILOT_TOOLS,
        onChunk: (text) => {
          accumulatedReply += text;
          send({ type: 'delta', text });
        },
        onToolCall: (name, args, id, thoughtSignature) => {
          currentToolCalls.push({ name, args, id, thoughtSignature });
          send({ type: 'tool_start', name });
        },
      });

      if (currentToolCalls.length === 0) {
        // No tool calls — model is done!
        send({ type: 'done', toolsUsed, pendingAction, reply: accumulatedReply });
        break;
      }

      // We have tool calls to execute
      const toolResultContents: any[] = [];
      const toolCallContent: any[] = [];

      for (const tc of currentToolCalls) {
        toolsUsed.push(tc.name);
        console.log(`[Copilot Gemini/stream] Executing Tool: ${tc.name}`);

        try {
          const { result, pendingAction: pa } = await executeTool(
            tc.name, tc.args, businessId
          );
          if (pa) pendingAction = pa;

          toolCallContent.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.args,
            thoughtSignature: tc.thoughtSignature,
          });

          toolResultContents.push({
            type: 'tool_result',
            tool_use_id: tc.id,
            name: tc.name,
            content: result,
          });
        } catch (err: any) {
          console.error(`[Copilot Gemini/stream] Tool error (${tc.name}):`, err);
          toolCallContent.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.args,
          });

          toolResultContents.push({
            type: 'tool_result',
            tool_use_id: tc.id,
            name: tc.name,
            is_error: true,
            content: err.message,
          });
        }
      }

      // Append tool uses and results and repeat the agentic loop
      loopMessages = [
        ...loopMessages,
        { role: 'assistant', content: toolCallContent },
        { role: 'user', content: toolResultContents },
      ];
    }

    res.end();
  } catch (err: any) {
    console.error('[Copilot Gemini/stream]', err);
    send({ type: 'error', message: err.message || 'Stream error' });
    res.end();
  }
});

export default router;
