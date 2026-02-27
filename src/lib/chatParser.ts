/**
 * chatParser.ts — WhatsApp .txt export parser
 *
 * Supported formats:
 *   [DD/MM/YY, HH:MM:SS] Name: message   (iOS / newer Android)
 *   DD/MM/YY, HH:MM - Name: message      (older Android)
 */

export interface ParsedMessage {
  role: 'client' | 'business';
  text: string;
  sender: string;
}

// Lines to skip — media attachments and system messages
const SKIP_PATTERNS = [
  /\barchivo adjunto\b/i,
  /\bimage omitted\b/i,
  /\baudio omitted\b/i,
  /\bvideo omitted\b/i,
  /\bsticker omitted\b/i,
  /\bdocument omitted\b/i,
  /\bgif omitted\b/i,
  /\bcontact card omitted\b/i,
  /<multimedia omitido>/i,
  /<media omitted>/i,
  /\bimagen omitida\b/i,
  /\baudio omitido\b/i,
  /\bvideo omitido\b/i,
  /\bsticker omitido\b/i,
  /\bdocumento omitido\b/i,
  /^Messages and calls are end-to-end encrypted/i,
  /^Los mensajes y las llamadas están cifrados/i,
  /^Este mensaje fue eliminado/i,
  /^You deleted this message/i,
];

// Format 1: [25/02/26, 10:30:15] Name: message
const LINE_REGEX_IOS = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?\]\s+([^:]+):\s+(.+)/;

// Format 2: 25/02/26, 10:30 - Name: message
const LINE_REGEX_ANDROID = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*\d{1,2}:\d{2}(?:\s*[APap][Mm])?\s+-\s+([^:]+):\s+(.+)/;

interface RawMessage {
  sender: string;
  text: string;
}

function parseLines(raw: string): RawMessage[] {
  const lines = raw.split(/\r?\n/);
  const messages: RawMessage[] = [];
  let current: RawMessage | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = LINE_REGEX_IOS.exec(trimmed) || LINE_REGEX_ANDROID.exec(trimmed);
    if (match) {
      if (current) messages.push(current);
      const sender = match[2].trim();
      const text = match[3].trim();
      current = { sender, text };
    } else if (current) {
      // Multi-line message continuation
      current.text += '\n' + trimmed;
    }
  }

  if (current) messages.push(current);
  return messages;
}

/**
 * Detects which sender is the "business" based on who responds most frequently.
 * The business is the one who replies to others most often.
 */
function detectBusinessSender(messages: RawMessage[]): string {
  const responseCounts: Record<string, number> = {};

  for (let i = 1; i < messages.length; i++) {
    const curr = messages[i].sender;
    const prev = messages[i - 1].sender;
    if (curr !== prev) {
      responseCounts[curr] = (responseCounts[curr] || 0) + 1;
    }
  }

  let topSender = '';
  let topCount = 0;
  for (const [sender, count] of Object.entries(responseCounts)) {
    if (count > topCount) {
      topCount = count;
      topSender = sender;
    }
  }

  return topSender;
}

/**
 * Parses a raw WhatsApp .txt export into structured messages with roles.
 */
export function parseWhatsAppChat(raw: string): ParsedMessage[] {
  const rawMessages = parseLines(raw);
  if (rawMessages.length === 0) return [];

  const businessSender = detectBusinessSender(rawMessages);

  return rawMessages
    .filter(({ text }) => !SKIP_PATTERNS.some((pattern) => pattern.test(text)))
    .map(({ sender, text }) => ({
      sender,
      role: sender === businessSender ? 'business' : 'client',
      text,
    }));
}

/**
 * Formats parsed messages into a compact string for AI analysis.
 * Trims to maxChars to stay within Claude's context budget.
 */
export function formatChatForAnalysis(
  messages: ParsedMessage[],
  maxChars = 15000,
): string {
  const lines = messages.map(
    (m) => `${m.role === 'business' ? 'NEGOCIO' : 'CLIENTE'}: ${m.text}`,
  );
  const joined = lines.join('\n');
  return joined.length > maxChars
    ? joined.slice(0, maxChars) + '\n[...truncado para análisis]'
    : joined;
}

/**
 * Returns basic stats about the parsed chat — useful for UI feedback.
 */
export function getChatStats(messages: ParsedMessage[]): {
  total: number;
  fromBusiness: number;
  fromClients: number;
  detectedBusinessName: string;
} {
  const fromBusiness = messages.filter((m) => m.role === 'business').length;
  const detectedBusinessName =
    messages.find((m) => m.role === 'business')?.sender ?? '';
  return {
    total: messages.length,
    fromBusiness,
    fromClients: messages.length - fromBusiness,
    detectedBusinessName,
  };
}
