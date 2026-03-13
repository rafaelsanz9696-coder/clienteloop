import type {
  Business,
  Contact,
  Conversation,
  Message,
  Task,
  PipelineDeal,
  PipelineGrouped,
  QuickReply,
  DashboardStats,
} from '../types/index';
import { supabase } from './supabase';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ─── Active business state ────────────────────────────────────────────────────
let _activeBusinessId: number = 1;

export function setActiveBusinessId(id: number): void {
  _activeBusinessId = id;
}

export function getActiveBusinessId(): number {
  return _activeBusinessId;
}
// ─────────────────────────────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Business
  getBusinesses: () => request<Business[]>('/business'),
  getBusiness: (id?: number) =>
    request<Business>(`/business/${id ?? _activeBusinessId}`),
  createBusiness: (data: { name: string; nicho: string }) =>
    request<Business>('/business', { method: 'POST', body: JSON.stringify(data) }),
  updateBusiness: (id: number, data: Partial<Business>) =>
    request<Business>(`/business/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Contacts
  getContacts: (params?: { stage?: string; search?: string }) => {
    const qs = new URLSearchParams({ business_id: String(_activeBusinessId) });
    if (params?.search) qs.set('search', params.search);
    if (params?.stage) qs.set('stage', params.stage);
    return request<Contact[]>(`/contacts?${qs}`);
  },
  getContact: (id: number) => request<Contact>(`/contacts/${id}`),
  createContact: (data: Partial<Contact>) =>
    request<Contact>('/contacts', { method: 'POST', body: JSON.stringify({ business_id: _activeBusinessId, ...data }) }),
  updateContact: (id: number, data: Partial<Contact>) =>
    request<Contact>(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateContactStage: (id: number, stage: string) =>
    request<{ success: boolean }>(`/contacts/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) }),
  deleteContact: (id: number) =>
    request<{ success: boolean }>(`/contacts/${id}`, { method: 'DELETE' }),

  // Conversations
  getConversations: (params?: { status?: string }) => {
    const qs = new URLSearchParams({ business_id: String(_activeBusinessId) });
    if (params?.status) qs.set('status', params.status);
    return request<Conversation[]>(`/conversations?${qs}`);
  },
  getConversation: (id: number) => request<Conversation>(`/conversations/${id}`),
  createConversation: (data: { contact_id: number; channel?: string }) =>
    request<Conversation>('/conversations', { method: 'POST', body: JSON.stringify({ business_id: _activeBusinessId, ...data }) }),
  updateConversationStatus: (id: number, status: string) =>
    request<{ success: boolean }>(`/conversations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  markConversationRead: (id: number) =>
    request<{ success: boolean }>(`/conversations/${id}/read`, { method: 'PATCH' }),
  assignConversation: (id: number, assigned_to: string) =>
    request<{ success: boolean }>(`/conversations/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ assigned_to }) }),

  // Messages
  getMessages: (conversationId: number) =>
    request<Message[]>(`/messages?conversation_id=${conversationId}`),
  sendMessage: (data: { conversation_id: number; content: string; sender?: string }) =>
    request<Message>('/messages', { method: 'POST', body: JSON.stringify(data) }),

  // Pipeline
  getPipeline: () => request<PipelineGrouped>(`/pipeline?business_id=${_activeBusinessId}`),
  createDeal: (data: Partial<PipelineDeal>) =>
    request<PipelineDeal>('/pipeline', { method: 'POST', body: JSON.stringify({ business_id: _activeBusinessId, ...data }) }),
  updateDealStage: (id: number, stage: string) =>
    request<{ success: boolean }>(`/pipeline/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) }),
  updateDeal: (id: number, data: Partial<PipelineDeal>) =>
    request<PipelineDeal>(`/pipeline/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDeal: (id: number) =>
    request<{ success: boolean }>(`/pipeline/${id}`, { method: 'DELETE' }),

  // Tasks
  getTasks: (params?: { status?: string }) => {
    const qs = new URLSearchParams({ business_id: String(_activeBusinessId) });
    if (params?.status) qs.set('status', params.status);
    return request<Task[]>(`/tasks?${qs}`);
  },
  createTask: (data: Partial<Task>) =>
    request<Task>('/tasks', { method: 'POST', body: JSON.stringify({ business_id: _activeBusinessId, ...data }) }),
  completeTask: (id: number) =>
    request<{ success: boolean }>(`/tasks/${id}/done`, { method: 'PATCH' }),
  deleteTask: (id: number) =>
    request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),

  // Stats
  getStats: () => request<DashboardStats>(`/stats?business_id=${_activeBusinessId}`),

  // Quick Replies
  getQuickReplies: (category?: string) => {
    const qs = new URLSearchParams({ business_id: String(_activeBusinessId) });
    if (category) qs.set('category', category);
    return request<QuickReply[]>(`/quick-replies?${qs}`);
  },
  createQuickReply: (data: Partial<QuickReply>) =>
    request<QuickReply>('/quick-replies', { method: 'POST', body: JSON.stringify({ business_id: _activeBusinessId, ...data }) }),
  updateQuickReply: (id: number, data: Partial<QuickReply>) =>
    request<QuickReply>(`/quick-replies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteQuickReply: (id: number) =>
    request<{ success: boolean }>(`/quick-replies/${id}`, { method: 'DELETE' }),

  // AI
  getAiSuggestion: (data: { conversation_id: number; tone?: string }) =>
    request<{ suggestion: string; escalate: boolean }>('/ai/suggest', { method: 'POST', body: JSON.stringify(data) }),
  getAiStatus: () => request<{ status: string; model: string }>('/ai/status'),
  getAiLogs: () => request<any[]>(`/ai/logs?business_id=${_activeBusinessId}`),
  extractAiTask: (conversationId: number) =>
    request<{ title: string; due_time: string | null; confidence: number } | null>('/ai/extract-task', {
      method: 'POST',
      body: JSON.stringify({ conversation_id: conversationId }),
    }),
  analyzeChats: (data: { chatText: string; businessName: string; nicho: string }) =>
    request<{ styleProfile: string; inputTokens?: number; outputTokens?: number }>('/ai/analyze-chats', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Billing
  getBillingSubscription: () =>
    request<{
      status: string;
      seats: number;
      included_seats: number;
      extra_seats: number;
      monthly_total_cents: number;
      period_end: string | null;
      trial_ends_at: string | null;
      has_subscription: boolean;
    }>('/billing/subscription'),
  createCheckoutSession: (seats: number) =>
    request<{ url: string }>('/billing/create-checkout', {
      method: 'POST',
      body: JSON.stringify({ seats }),
    }),
  createBillingPortal: () =>
    request<{ url: string }>('/billing/create-portal', { method: 'POST' }),
  updateBillingSeats: (seats: number) =>
    request<{ seats: number; extra_seats: number }>('/billing/seats', {
      method: 'PATCH',
      body: JSON.stringify({ seats }),
    }),

  // Channel Numbers
  getChannelNumbers: () =>
    request<{ id: number; business_id: number; channel: string; identifier: string; label: string; created_at: string }[]>(
      `/business/channels?business_id=${_activeBusinessId}`
    ),
  saveChannelNumber: (data: { channel: string; identifier: string; label?: string }) =>
    request<{ id: number; business_id: number; channel: string; identifier: string; label: string }>(
      '/business/channels',
      { method: 'POST', body: JSON.stringify({ business_id: _activeBusinessId, ...data }) },
    ),
  deleteChannelNumber: (id: number) =>
    request<{ success: boolean }>(`/business/channels/${id}`, { method: 'DELETE' }),
};
