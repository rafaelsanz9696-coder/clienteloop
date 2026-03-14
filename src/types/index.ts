export interface Business {
  id: number;
  name: string;
  nicho: 'salon' | 'clinica' | 'inmobiliaria' | 'restaurante' | 'academia' | 'taller';
  owner_name: string;
  email: string | null;
  phone: string | null;
  working_hours: string;
  ai_context: string;
  created_at: string;
  booking_slug?: string | null;
  my_role?: 'admin' | 'agent';
}

export interface TeamMember {
  id: number;
  business_id: number;
  supabase_user_id: string;
  email: string;
  role: 'admin' | 'agent';
  invited_by: string | null;
  joined_at: string;
}

export interface TeamInvitation {
  id: number;
  business_id: number;
  email: string | null;
  role: 'admin' | 'agent';
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface Contact {
  id: number;
  business_id: number;
  name: string;
  phone: string | null;
  email: string | null;
  channel: 'whatsapp' | 'instagram' | 'email' | 'web';
  pipeline_stage: 'new' | 'in_progress' | 'closed';
  status: 'open' | 'resolved';
  tags: string;
  notes: string;
  last_contact_at: string;
  created_at: string;
}

export interface Conversation {
  id: number;
  business_id: number;
  contact_id: number;
  channel: string;
  status: 'open' | 'resolved';
  assigned_to: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  created_at: string;
  contact_name?: string;
  contact_phone?: string;
  contact_channel?: string;
  pipeline_stage?: string;
  contact_notes?: string;
  intent_label?: string | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  content: string;
  sender: 'client' | 'agent';
  is_ai_generated: number;
  created_at: string;
}

export interface Task {
  id: number;
  business_id: number;
  contact_id: number | null;
  title: string;
  due_time: string | null;
  status: 'pending' | 'done';
  created_at: string;
  contact_name?: string;
}

export interface PipelineDeal {
  id: number;
  business_id: number;
  contact_id: number;
  title: string;
  stage: 'new' | 'in_progress' | 'closed';
  value: number;
  notes: string;
  created_at: string;
  contact_name?: string;
  contact_phone?: string;
  channel?: string;
}

export interface QuickReply {
  id: number;
  business_id: number;
  title: string;
  content: string;
  category: string;
  created_at: string;
}

export interface DashboardStats {
  newLeadsToday: number;
  appointmentsThisWeek: number;
  revenueThisMonth: number;
  openConversations: number;
  pendingTasks: number;
  growthPercent: number;
  chartData: Array<{ name: string; leads: number; citas: number; ventas: number }>;
}

export interface PipelineGrouped {
  new: PipelineDeal[];
  in_progress: PipelineDeal[];
  closed: PipelineDeal[];
}

export interface ContactNote {
  id: number;
  business_id: number;
  contact_id: number;
  content: string;
  created_at: string;
}

export interface ActivityEntry {
  id: number;
  business_id: number;
  contact_id: number | null;
  type: string;
  description: string;
  created_at: string;
  contact_name?: string;
}

export interface SearchResults {
  contacts: Pick<Contact, 'id' | 'name' | 'phone' | 'email' | 'channel' | 'pipeline_stage'>[];
  conversations: {
    id: number;
    last_message: string;
    last_message_at: string;
    channel: string;
    contact_name: string;
  }[];
  deals: {
    id: number;
    title: string;
    stage: string;
    value: number;
    contact_name: string;
  }[];
}

export interface ReportData {
  totalLeads: number;
  revenue: number;
  conversionRate: number;
  activeDeals: number;
  funnel: { new: number; in_progress: number; closed: number };
  topContacts: { id: number; name: string; channel: string; total_value: number; deal_count: number }[];
  chartData: { day: string; leads: number }[];
}

export interface Appointment {
  id: number;
  business_id: number;
  contact_id: number | null;
  service_id: number | null;
  title: string;
  start_time: string;        // ISO 8601
  end_time: string;          // ISO 8601
  duration_minutes: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  notes: string | null;
  contact_name?: string;
  service_name?: string;
  created_at: string;
  reminder_sent_at?: string | null;
}

export interface Service {
  id: number;
  business_id: number;
  name: string;
  duration_minutes: number;
  price: number | null;
  active: boolean;
}

export interface Broadcast {
  id: number;
  business_id: number;
  name: string;
  message: string;
  status: 'draft' | 'sending' | 'completed' | 'failed';
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  sent_at: string | null;
  recipients?: BroadcastRecipient[];
}

export interface BroadcastRecipient {
  id: number;
  broadcast_id: number;
  contact_id: number | null;
  phone: string;
  name: string;
  status: 'pending' | 'sent' | 'failed';
  error: string | null;
  sent_at: string | null;
}

export type MemoryType = 'style' | 'faq' | 'pattern' | 'client_insight';

export interface BusinessMemory {
  id: number;
  business_id: number;
  type: MemoryType;
  content: string;
  source: 'auto_learned' | 'manual';
  relevance: number;
  created_at: string;
  updated_at: string;
}

