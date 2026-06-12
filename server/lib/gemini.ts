/**
 * gemini.ts — Central gateway for Google Gemini Developer API
 *
 * Provides functions to map chat prompts, messages, and tool declarations
 * into Gemini API payloads and handles non-streaming
 * as well as SSE streaming responses.
 */

import { TextDecoder } from 'util';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function resolveModelName(requestedModel: string): string {
  const model = (requestedModel || '').toLowerCase();
  if (model.includes('pro')) {
    return 'gemini-3.1-pro';
  }
  return 'gemini-3.5-flash';
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn('[Gemini] GEMINI_API_KEY is not set. Please configure it in your .env file.');
    return '';
  }
  return key;
}

// Recursively convert JSON schema types to UPPERCASE for Gemini specifications
function convertSchemaToGemini(schema: any): any {
  if (!schema) return schema;
  const newSchema = { ...schema };
  if (typeof newSchema.type === 'string') {
    newSchema.type = newSchema.type.toUpperCase();
  }
  if (newSchema.properties) {
    const newProps: Record<string, any> = {};
    for (const [k, v] of Object.entries(newSchema.properties)) {
      newProps[k] = convertSchemaToGemini(v);
    }
    newSchema.properties = newProps;
  }
  if (newSchema.items) {
    newSchema.items = convertSchemaToGemini(newSchema.items);
  }
  return newSchema;
}

// Convert tool definitions to Gemini function declarations format
function convertToolsToGemini(tools: any[]): any[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: convertSchemaToGemini(t.input_schema || t.parameters),
  }));
}

// Convert chat messages to Gemini-style contents
export function convertMessagesToGemini(messages: any[]): any[] {
  const contents: any[] = [];

  for (const m of messages) {
    let role = m.role;
    if (role === 'assistant') role = 'model';

    let parts: any[] = [];

    if (typeof m.content === 'string') {
      parts = [{ text: m.content }];
    } else if (Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type === 'text') {
          parts.push({ text: block.text });
        } else if (block.type === 'tool_use') {
          parts.push({
            functionCall: {
              name: block.name,
              args: block.input || {},
            },
            ...(block.thoughtSignature ? { thoughtSignature: block.thoughtSignature } : {}),
          });
        } else if (block.type === 'tool_result') {
          // If we encounter a tool_result inside an array, it corresponds to a response.
          // Wait! In Gemini, the tool response is represented as a separate message with role 'function'.
          // So we push the previous model parts (if any) and push a separate message with role 'function'.
          contents.push({
            role: 'function',
            parts: [
              {
                functionResponse: {
                  name: block.name || '',
                  response: { output: block.content },
                },
              },
            ],
          });
        }
      }
    }

    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }

  // Gemini requires strict alternating turns (user -> model -> user ...).
  // If there are duplicate consecutive roles, merge their parts.
  const mergedContents: any[] = [];
  for (const item of contents) {
    const prev = mergedContents[mergedContents.length - 1];
    if (prev && prev.role === item.role) {
      prev.parts = [...prev.parts, ...item.parts];
    } else {
      mergedContents.push(item);
    }
  }

  return mergedContents;
}

// Makes a non-streaming request to Gemini API
export async function geminiRequest(params: {
  model: string;
  systemPrompt?: string;
  messages: any[];
  tools?: any[];
  temperature?: number;
  maxTokens?: number;
}): Promise<{
  text: string;
  toolCalls?: Array<{ name: string; args: any; id: string; thoughtSignature?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}> {
  const apiKey = getApiKey();
  const modelName = resolveModelName(params.model);
  const url = `${GEMINI_BASE_URL}/${modelName}:generateContent?key=${apiKey}`;

  const payload: any = {
    contents: convertMessagesToGemini(params.messages),
    generationConfig: {
      temperature: params.temperature ?? 0.5,
      maxOutputTokens: params.maxTokens ?? 1500,
    },
  };

  if (params.systemPrompt) {
    payload.systemInstruction = {
      parts: [{ text: params.systemPrompt }],
    };
  }

  if (params.tools && params.tools.length > 0) {
    payload.tools = [{ functionDeclarations: convertToolsToGemini(params.tools) }];
  }

  console.log(`[Gemini Request] Calling ${modelName}...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  let text = '';
  const toolCalls: any[] = [];

  for (const part of parts) {
    if (part.text) {
      text += part.text;
    }
    if (part.functionCall) {
      toolCalls.push({
        name: part.functionCall.name,
        args: part.functionCall.args || {},
        id: part.functionCall.name + '_' + Math.random().toString(36).substr(2, 5),
        thoughtSignature: part.thoughtSignature,
      });
    }
  }

  // Map Gemini usage to the app's shared token usage shape.
  const inputTokens = data.usageMetadata?.promptTokenCount || 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;

  return {
    text,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

// Handles SSE streaming request to Gemini API
export async function geminiStream(params: {
  model: string;
  systemPrompt?: string;
  messages: any[];
  tools?: any[];
  temperature?: number;
  maxTokens?: number;
  onChunk: (text: string) => void;
  onToolCall: (name: string, args: any, id: string, thoughtSignature?: string) => void;
}): Promise<void> {
  const apiKey = getApiKey();
  const modelName = resolveModelName(params.model);
  // Use alt=sse to receive Server-Sent Events
  const url = `${GEMINI_BASE_URL}/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`;

  const payload: any = {
    contents: convertMessagesToGemini(params.messages),
    generationConfig: {
      temperature: params.temperature ?? 0.5,
      maxOutputTokens: params.maxTokens ?? 1500,
    },
  };

  if (params.systemPrompt) {
    payload.systemInstruction = {
      parts: [{ text: params.systemPrompt }],
    };
  }

  if (params.tools && params.tools.length > 0) {
    payload.tools = [{ functionDeclarations: convertToolsToGemini(params.tools) }];
  }

  console.log(`[Gemini Stream] Calling ${modelName}...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini stream failed (${response.status}): ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine.startsWith('data:')) continue;

      const dataStr = cleanLine.substring(5).trim();
      if (!dataStr) continue;

      try {
        const chunk = JSON.parse(dataStr);
        const parts = chunk.candidates?.[0]?.content?.parts || [];

        for (const part of parts) {
          if (part.text) {
            params.onChunk(part.text);
          }
          if (part.functionCall) {
            const tc = part.functionCall;
            const fakeId = tc.name + '_' + Math.random().toString(36).substr(2, 5);
            params.onToolCall(tc.name, tc.args || {}, fakeId, part.thoughtSignature);
          }
        }
      } catch (err) {
        console.error('[Gemini Stream] Error parsing SSE line:', err, cleanLine);
      }
    }
  }
}
