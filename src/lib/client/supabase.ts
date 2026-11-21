'use client';
// Один клиент Supabase на браузер (anon-ключ): вход и загрузка файлов по подписанным ссылкам.
// Сессию входа хранит сам supabase-js. Без ключей (локальный режим) — null.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { useSyncExternalStore } from 'react';

/** Есть ли вход вообще (ключи Supabase вшиты в сборку браузера). */
export const authAvailable = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const noop = () => () => undefined;
/** То же для разметки: на сервере считаем, что вход есть, а в браузере проверяем по-настоящему — без расхождений при гидрации. */
export const useAuthAvailable = (): boolean => useSyncExternalStore(noop, () => authAvailable, () => true);

let client: SupabaseClient | null | undefined;

export function browserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
  return client;
}
