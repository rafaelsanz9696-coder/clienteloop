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
  BusinessMemory,
  ContactNote,
  ActivityEntry,
  SearchResults,
  ReportData,
  Appointment,
  Service,
  Broadcast,
  TeamMember,
  TeamInvitation,
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

  // Tell backend which business is active (supports multi-business switching)
  headers['x-business-id'] = String(_activeBusinessId);

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

async function requestBlob(path: string): Promise<Blob> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  headers['x-business-id'] = String(_activeBusinessId);
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.blob();
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
  updateBookingSlug: (slug: string) =>
    request<{ success: boolean; booking_slug: string | null }>('/business/booking-slug', {
      method: 'PATCH',
      body: JSON.stringify({ booking_slug: slug }),
    }),

  // Contacts
  getContacts: (params?: { stage?: string; search?: string; tag?: string }) => {
    const qs = new URLSearchParams({ business_id: String(_activeBusinessId) });
    if (params?.search) qs.set('search', params.search);
    if (params?.stage) qs.set('stage', params.stage);
    if (params?.tag) qs.set('tag', params.tag);
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
  exportContactsCSV: async () => {
    const blob = await requestBlob('/contacts/export');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contactos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
  importContactsCSV: (csv: string) =>
    request<{ inserted: number; updated: number; skipped: number; errors: string[] }>(
      '/contacts/import', { method: 'POST', body: JSON.stringify({ csv }) }
    ),

  // Conversations
  getUnreadCount: () => request<{ count: number }>('/conversations/unread-count'),
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

  // AI Copilot
  copilotChat: (messages: Array<{ role: string; content: string }>) =>
    request<{ reply: string; toolsUsed: string[]; pendingAction?: any }>('/ai/copilot', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),

  // Setup Assistant
  setupAssistantChat: (messages: Array<{ role: string; content: string }>) =>
    request<{ reply: string; setupComplete: boolean }>('/ai/setup-assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),
  setupAssistantFinalize: (messages: Array<{ role: string; content: string }>) =>
    request<{ memoriesCreated: number; quickRepliesCreated: number; contextUpdated: boolean }>(
      '/ai/setup-assistant/finalize',
      { method: 'POST', body: JSON.stringify({ messages }) },
    ),

  // Contact Notes
  getNotes: (contactId: number) =>
    request<ContactNote[]>(`/notes?contact_id=${contactId}`),
  createNote: (contactId: number, content: string) =>
    request<ContactNote>('/notes', { method: 'POST', body: JSON.stringify({ contact_id: contactId, content }) }),
  deleteNote: (id: number) =>
    request<{ success: boolean }>(`/notes/${id}`, { method: 'DELETE' }),

  // Global search
  globalSearch: (q: string) =>
    request<SearchResults>(`/search?q=${encodeURIComponent(q)}`),

  // Reports
  getReports: (from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    return request<ReportData>(`/reports?${qs}`);
  },

  // Activity log
  getActivity: (contactId?: number) => {
    const qs = contactId ? `?contact_id=${contactId}` : '';
    return request<ActivityEntry[]>(`/activity${qs}`);
  },

  // Contact-scoped data (for contact profile panel)
  getContactDeals: (contactId: number) =>
    request<PipelineDeal[]>(`/pipeline?contact_id=${contactId}`),
  getContactConversations: (contactId: number) =>
    request<Conversation[]>(`/conversations?contact_id=${contactId}`),
  getContactTasks: (contactId: number) =>
    request<Task[]>(`/tasks?contact_id=${contactId}`),

  // Appointments
  getAppointments: (from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to)   qs.set('to', to);
    return request<Appointment[]>(`/appointments?${qs}`);
  },
  getAvailableSlots: (date: string, duration: number) =>
    request<string[]>(`/appointments/slots?date=${date}&duration=${duration}`),
  createAppointment: (data: Partial<Appointment> & { start_time: string }) =>
    request<Appointment>('/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateAppointment: (id: number, data: Partial<Appointment>) =>
    request<Appointment>(`/appointments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateAppointmentStatus: (id: number, status: string) =>
    request<{ success: boolean }>(`/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteAppointment: (id: number) =>
    request<{ success: boolean }>(`/appointments/${id}`, { method: 'DELETE' }),
  sendReminder: (id: number) =>
    request<{ sent: boolean; phone?: string; reason?: string; appointment?: Appointment }>(
      `/appointments/${id}/remind`, { method: 'POST' }
    ),

  // Services
  getServices: () => request<Service[]>('/services'),
  createService: (data: { name: string; duration_minutes: number; price?: number }) =>
    request<Service>('/services', { method: 'POST', body: JSON.stringify(data) }),
  updateService: (id: number, data: Partial<Service>) =>
    request<Service>(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteService: (id: number) =>
    request<{ success: boolean }>(`/services/${id}`, { method: 'DELETE' }),

  // Agentic Memories
  getMemories: () =>
    request<BusinessMemory[]>('/memories'),
  createMemory: (data: { type: string; content: string; relevance?: number }) =>
    request<BusinessMemory>('/memories', { method: 'POST', body: JSON.stringify(data) }),
  updateMemory: (id: number, data: { content?: string; relevance?: number }) =>
    request<BusinessMemory>(`/memories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMemory: (id: number) =>
    request<{ success: boolean }>(`/memories/${id}`, { method: 'DELETE' }),

  // Broadcasts
  getBroadcasts: () => request<Broadcast[]>('/broadcasts'),
  getBroadcast: (id: number) => request<Broadcast>(`/broadcasts/${id}`),
  previewBroadcastCount: (type: string, value?: string) => {
    const qs = new URLSearchParams({ type });
    if (value) qs.set('value', value);
    return request<{ count: number }>(`/broadcasts/preview/count?${qs}`);
  },
  createBroadcast: (data: { name: string; message: string; filter: { type: string; value?: string } }) =>
    request<Broadcast>('/broadcasts', { method: 'POST', body: JSON.stringify(data) }),
  sendBroadcast: (id: number) =>
    request<{ started: boolean; broadcast_id: number }>(`/broadcasts/${id}/send`, { method: 'POST' }),
  deleteBroadcast: (id: number) =>
    request<{ success: boolean }>(`/broadcasts/${id}`, { method: 'DELETE' }),

  // Team management
  getTeam: () =>
    request<{ owner: any; members: TeamMember[]; limit: number; total: number; plan: string; my_role: string }>('/team'),
  getTeamInvitations: () =>
    request<TeamInvitation[]>('/team/invitations'),
  previewInvite: (token: string) =>
    request<{ business_id: number; business_name: string; role: string; expires_at: string }>(`/team/join/${token}`),
  inviteMember: (data: { email?: string; role: 'admin' | 'agent' }) =>
    request<{ token: string; link: string; expires_at: string }>('/team/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  joinBusiness: (token: string) =>
    request<{ success: boolean; business_id: number; business_name: string; role: string }>('/team/join', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  revokeInvitation: (id: number) =>
    request<{ success: boolean }>(`/team/invitations/${id}`, { method: 'DELETE' }),
  updateMemberRole: (memberId: number, role: 'admin' | 'agent') =>
    request<TeamMember>(`/team/${memberId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  removeMember: (memberId: number) =>
    request<{ success: boolean }>(`/team/${memberId}`, { method: 'DELETE' }),
};
