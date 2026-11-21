// Серверный клиент Supabase с service role. Только для API-роутов и скриптов, никогда в браузере.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isLocalMode, localClient } from './local';

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  // Нет ключей на этом компьютере — локальный режим: данные и файлы в .local-data/ (на Vercel не бывает).
  if (isLocalMode()) {
    console.warn('Supabase: ключей нет — локальный режим, данные в .local-data/');
    client = localClient() as unknown as SupabaseClient;
    return client;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase не настроен: нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY');
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export const BUCKET = 'days';
