'use client';
// Вход и регистрация (план 21.11, часть A). Контракт для частей B и C: пользуйтесь только этим файлом.
// Supabase Auth, почта + пароль. Сессию держит supabase-js; сервер проверяет токен из authHeaders().
// После входа дневники аккаунта ложатся на полку устройства — дальше всё работает по-старому (x-diary-key).
import { useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';
import { authErrorText } from '@/lib/authShared';
import { addToShelf, clearShelf, ownerHeaders } from './diaryKey';
import { browserSupabase } from './supabase';

export interface AuthUser { id: string; email: string; name: string | null }
interface AuthState { user: AuthUser | null; loading: boolean }

// ── Хранилище состояния входа: один на вкладку, React читает его через useSyncExternalStore ──
const SERVER: AuthState = { user: null, loading: true };
let state: AuthState = { user: null, loading: true };
let token: string | null = null;
let started = false;
const listeners = new Set<() => void>();

const toUser = (s: Session | null): AuthUser | null => (s?.user ? {
  id: s.user.id, email: s.user.email ?? '',
  name: typeof s.user.user_metadata?.name === 'string' && s.user.user_metadata.name.trim() ? s.user.user_metadata.name.trim() : null,
} : null);

function set(s: Session | null) {
  token = s?.access_token ?? null;
  const user = toUser(s);
  // Новый объект только при настоящей смене: иначе React перерисовывал бы всё на каждое обновление токена.
  if (state.loading || state.user?.id !== user?.id || state.user?.name !== user?.name) state = { user, loading: false };
  listeners.forEach((l) => l());
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const sb = browserSupabase();
  if (!sb) { state = { user: null, loading: false }; return; }   // локальный режим: аккаунтов нет
  sb.auth.getSession().then(({ data }) => {
    set(data.session);
    // Открыли сайт уже вошедшим (другая вкладка, новый день): подтягиваем дневники аккаунта на полку.
    if (data.session) void syncShelf().catch(() => undefined);
  }, () => set(null));
  sb.auth.onAuthStateChange((_e, s) => set(s));
}

function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Кто вошёл. loading — пока не знаем (первый кадр, на сервере). Без Supabase (локальный режим) — всегда null. */
export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => { start(); return state; }, () => SERVER);
}

/** Заголовок Authorization: Bearer <token>, если человек вошёл; иначе пусто. */
export function authHeaders(): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {};
}

/** Дневники с этого устройства привязываются к аккаунту, а дневники аккаунта ложатся на полку устройства. */
async function syncShelf(): Promise<void> {
  const headers = { ...authHeaders(), ...ownerHeaders() };
  await fetch('/api/me/claim', { method: 'POST', headers }).catch(() => undefined);
  const res = await fetch('/api/me/diaries', { headers: authHeaders() });
  if (!res.ok) return;
  const { ids } = (await res.json()) as { ids: string[] };
  ids.forEach(addToShelf);
}

function need() {
  const sb = browserSupabase();
  if (!sb) throw new Error('Вход работает на сайте: на этом компьютере не подключены ключи Supabase');
  return sb;
}

/** Регистрация: почта, пароль (от 6 знаков), имя. Ошибка — Error с понятным русским текстом. */
export async function signUp(email: string, password: string, name?: string): Promise<AuthUser> {
  const sb = need();
  let r;
  try { r = await sb.auth.signUp({ email: email.trim(), password, options: { data: name?.trim() ? { name: name.trim() } : {} } }); }
  catch (e) { throw new Error(authErrorText(e instanceof Error ? e.message : '')); }
  if (r.error) throw new Error(authErrorText(r.error.message));
  // Включено подтверждение почты и такой адрес уже есть: Supabase молча возвращает пользователя без входов.
  if (r.data.user && r.data.user.identities?.length === 0) throw new Error(authErrorText('User already registered'));
  if (!r.data.session) throw new Error(`Мы отправили письмо на ${email.trim()}. Откройте его, подтвердите почту и войдите.`);
  set(r.data.session);
  await syncShelf().catch(() => undefined);
  return toUser(r.data.session)!;
}

/** Вход по почте и паролю. Ошибка — Error с понятным русским текстом. */
export async function signIn(email: string, password: string): Promise<AuthUser> {
  const sb = need();
  let r;
  try { r = await sb.auth.signInWithPassword({ email: email.trim(), password }); }
  catch (e) { throw new Error(authErrorText(e instanceof Error ? e.message : '')); }
  if (r.error || !r.data.session) throw new Error(authErrorText(r.error?.message));
  set(r.data.session);
  await syncShelf().catch(() => undefined);
  return toUser(r.data.session)!;
}

/** Выход: сессия и полка дневников этого устройства очищаются. */
export async function signOut(): Promise<void> {
  await browserSupabase()?.auth.signOut().catch(() => undefined);
  set(null);
  clearShelf();
}

/** Адреса страниц входа (страница, куда вернуть после входа, — в ?next=). */
export const AUTH_ROUTES = { signup: '/signup', login: '/login', home: '/home' } as const;
export const loginUrl = (next?: string) => `${AUTH_ROUTES.login}${next ? `?next=${encodeURIComponent(next)}` : ''}`;
