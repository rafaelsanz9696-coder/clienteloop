import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using service role key (bypasses RLS for Storage uploads)
let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (!_client) {
    const url = process.env.VITE_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !key) {
      throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for media storage');
    }
    _client = createClient(url, key, { auth: { persistSession: false } });
  }
  return _client;
}
