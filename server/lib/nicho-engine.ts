import Anthropic from '@anthropic-ai/sdk';
import { NICHO_PROMPTS, NICHO_CONFIGS, GLOBAL_GUARDRAILS, type Nicho } from './nicho-prompts.js';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not set');
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

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
  const anthropic = getClient();

  const systemPrompt = `Eres un asistente experto en CRM. Tu tarea es extraer UNA SOLA tarea accionable de la conversación proporcionada.
  Si no hay una tarea clara (como agendar una cita, llamar luego, enviar info), responde con NULL.
  Si hay una tarea, responde ÚNICAMENTE en formato JSON:
  {
    "title": "Nombre breve de la tarea",
    "due_time": "ISO timestamp o null",
    "confidence": 0.0 a 1.0
  }
  
  ${GLOBAL_GUARDRAILS}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    temperature: 0,
    system: systemPrompt,
    messages: [
      ...params.conversationHistory,
      { role: 'user', content: 'Extrae la siguiente tarea de esta conversación.' },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text')?.text;
  if (!textContent || textContent.includes('NULL')) return null;

  try {
    return JSON.parse(textContent);
  } catch {
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

  systemPrompt += `\n\n${GLOBAL_GUARDRAILS}`;

  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    system: systemPrompt,
    messages: [
      ...params.conversationHistory,
      { role: 'user', content: params.newMessage },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');

  return {
    response: textContent ? textContent.text : '',
    escalate: false,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
