/**
 * infobip.ts — Infobip multi-channel API client
 * Handles outgoing WhatsApp, SMS, and Email messages.
 *
 * Auth: Authorization: App {API_KEY}
 * Docs: https://www.infobip.com/docs/api
 */

function getConfig() {
  return {
    baseUrl: (process.env.INFOBIP_BASE_URL || 'https://api.infobip.com').replace(/\/$/, ''),
    apiKey: process.env.INFOBIP_API_KEY || '',
  };
}

function jsonHeaders() {
  const { apiKey } = getConfig();
  return {
    Authorization: `App ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export function isConfigured(): boolean {
  const { apiKey, baseUrl } = getConfig();
  return !!(apiKey && baseUrl && !baseUrl.includes('XXXXXX'));
}

// ─── WhatsApp ────────────────────────────────────────────────────────────────

export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  const { baseUrl } = getConfig();
  const sender = process.env.INFOBIP_WHATSAPP_SENDER;
  if (!sender) throw new Error('INFOBIP_WHATSAPP_SENDER not set in .env');

  const response = await fetch(`${baseUrl}/whatsapp/1/message/text`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      from: sender,
      to,
      content: { text },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Infobip WhatsApp ${response.status}: ${body}`);
  }
}

// ─── SMS ─────────────────────────────────────────────────────────────────────

export async function sendSmsMessage(to: string, text: string): Promise<void> {
  const { baseUrl } = getConfig();
  const sender = process.env.INFOBIP_SMS_SENDER || 'ClienteLoop';

  const response = await fetch(`${baseUrl}/sms/2/text/advanced`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      messages: [
        {
          from: sender,
          destinations: [{ to }],
          text,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Infobip SMS ${response.status}: ${body}`);
  }
}

// ─── Email ───────────────────────────────────────────────────────────────────

export async function sendEmailMessage(
  to: string,
  text: string,
  subject = 'Nuevo mensaje',
): Promise<void> {
  const { baseUrl, apiKey } = getConfig();
  const from = process.env.INFOBIP_EMAIL_FROM;
  if (!from) throw new Error('INFOBIP_EMAIL_FROM not set in .env');

  // Infobip email API uses multipart/form-data
  const form = new FormData();
  form.append('from', from);
  form.append('to', to);
  form.append('subject', subject);
  form.append('text', text);

  const response = await fetch(`${baseUrl}/email/3/send`, {
    method: 'POST',
    headers: {
      Authorization: `App ${apiKey}`,
      Accept: 'application/json',
    },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Infobip Email ${response.status}: ${body}`);
  }
}
