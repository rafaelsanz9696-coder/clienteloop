import { geminiRequest } from './gemini.js';
import { NICHO_PROMPTS, NICHO_CONFIGS, GLOBAL_GUARDRAILS, type Nicho } from './nicho-prompts.js';

export interface NichoAIResponse {
  response: string | null;
  escalate: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

export interface ExtractedTask {
  title: string;
  due_time: string | null;
  confidence: number;
}

export async function extractTaskFromConversation(params: {
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<ExtractedTask | null> {
  const systemPrompt = `Eres un asistente experto en CRM. Tu tarea es extraer UNA SOLA tarea accionable de la conversación proporcionada.
  Si no hay una tarea clara (como agendar una cita, llamar luego, enviar info), responde con NULL.
  Si hay una tarea, responde ÚNICAMENTE en formato JSON:
  {
    "title": "Nombre breve de la tarea",
    "due_time": "ISO timestamp o null",
    "confidence": 0.0 a 1.0
  }
  
  ${GLOBAL_GUARDRAILS}`;

  try {
    const response = await geminiRequest({
      model: 'gemini-3.5-flash',
      systemPrompt,
      messages: [
        ...params.conversationHistory,
        { role: 'user', content: 'Extrae la siguiente tarea de esta conversación.' },
      ],
      temperature: 0,
      maxTokens: 300,
    });

    const textContent = response.text;
    if (!textContent || textContent.includes('NULL')) return null;

    // Strip markdown JSON wrappers if any
    const jsonStr = textContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('[Nicho Engine] extractTaskError:', err);
    return null;
  }
}

export async function respondWithNichoAI(params: {
  nicho: Nicho;
  businessName: string;
  negocioContext: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  newMessage: string;
  tone?: 'corto' | 'formal' | 'persuasivo';
  memories?: string; // Injected by AgentMemory for agentic-plan businesses
  clientUsesEmojis?: boolean; // Adapt emoji usage to client style
  scheduleContext?: string;   // Available appointment slots for conflict-aware scheduling
}): Promise<NichoAIResponse> {
  const config = NICHO_CONFIGS[params.nicho];
  const promptTemplate = NICHO_PROMPTS[params.nicho];

  if (!promptTemplate || !config) {
    return { response: null, escalate: true };
  }

  // Check for escalation keywords before calling the API
  const lowerMessage = params.newMessage.toLowerCase();
  const requiresEscalation = config.escalationKeywords.some(
    (kw) => lowerMessage.includes(kw.toLowerCase())
  );

  if (requiresEscalation) {
    return { response: null, escalate: true };
  }

  // Build system prompt from template
  let systemPrompt = promptTemplate
    .replace(/\{\{nombre_negocio\}\}/g, params.businessName)
    .replace(/\{\{contexto_negocio\}\}/g, params.negocioContext || 'No hay contexto adicional configurado.');

  if (params.tone) {
    const toneInstructions = {
      corto: 'Responde de forma muy breve y directa, máximo 1-2 oraciones.',
      formal: 'Responde con un tono profesional, educado y estructurado.',
      persuasivo: 'Responde con un tono enfocado en cerrar la venta o cita, resaltando beneficios.',
    };
    systemPrompt += `\n\nINSTRUCCIÓN DE TONO: ${toneInstructions[params.tone]}`;
  }

  // Adapt emoji usage to client's style
  if (params.clientUsesEmojis !== undefined) {
    systemPrompt += params.clientUsesEmojis
      ? '\n\nEMOJIS: El cliente usa emojis en sus mensajes. Puedes incluir 1-2 emojis si es natural para el contexto.'
      : '\n\nEMOJIS: El cliente NO usa emojis. No incluyas ningún emoji en tu respuesta.';
  }

  // Inject per-business learned memories (agentic plan only)
  if (params.memories) {
    systemPrompt += params.memories;
  }

  // Inject available appointment slots so AI can detect conflicts and suggest alternatives
  if (params.scheduleContext) {
    systemPrompt += `\n\nDISPONIBILIDAD DE CITAS (próximos días):\n${params.scheduleContext}

REGLA CRÍTICA DE CITAS: Si el cliente pide una cita o pregunta por disponibilidad:
1. Revisa los horarios libres arriba.
2. Si la hora solicitada NO aparece en la lista (está ocupada o fuera de horario), NO la confirmes.
3. Ofrece exactamente 3 alternativas de la lista de horarios disponibles.
4. Confirma la cita solo con horarios que aparezcan en la lista.`;
  }

  systemPrompt += `\n\n${GLOBAL_GUARDRAILS}`;

  try {
    const response = await geminiRequest({
      model: 'gemini-3.5-flash',
      systemPrompt,
      messages: [
        ...params.conversationHistory,
        { role: 'user', content: params.newMessage },
      ],
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    return {
      response: response.text || '',
      escalate: false,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
    };
  } catch (err: any) {
    console.error('[Nicho Engine] respondError:', err);
    return { response: null, escalate: true };
  }
}
