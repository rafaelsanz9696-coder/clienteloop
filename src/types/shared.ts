export type Nicho = 'salon' | 'clinica' | 'inmobiliaria' | 'restaurante' | 'academia' | 'taller';

export interface Business {
  id: number;
  name: string;
  nicho: Nicho;
  owner_name: string;
  email: string | null;
  phone: string | null;
  working_hours: {
    weekdays: string;
    saturday: string;
    sunday: string;
  } | string;
  ai_context: string;
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
  tags: string; // JSON string
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
  // Join fields
  contact_name?: string;
  contact_phone?: string;
  contact_channel?: string;
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
}

export interface QuickReply {
  id: number;
  business_id: number;
  title: string;
  content: string;
  category: string;
  created_at: string;
}

export interface AIResponse {
  suggestion: string;
  escalate: boolean;
  error?: string;
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
