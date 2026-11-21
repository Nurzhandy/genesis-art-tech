'use client';
// Вход и регистрация (план 21.11, часть A). Контракт для частей B и C: пользуйтесь только этим файлом.
// ЗАГЛУШКА: настоящая реализация (Supabase Auth) придёт следующим коммитом, сигнатуры не изменятся.

export interface AuthUser { id: string; email: string; name: string | null }

/** Кто вошёл. loading — пока не знаем (первый кадр, на сервере). Без Supabase (локальный режим) — всегда null. */
export function useAuth(): { user: AuthUser | null; loading: boolean } {
  return { user: null, loading: false };
}

/** Регистрация: почта, пароль (от 6 знаков), имя. Ошибка — Error с понятным русским текстом. */
export async function signUp(_email: string, _password: string, _name?: string): Promise<AuthUser> {
  throw new Error('Регистрация ещё не подключена');
}

/** Вход по почте и паролю. Ошибка — Error с понятным русским текстом. */
export async function signIn(_email: string, _password: string): Promise<AuthUser> {
  throw new Error('Вход ещё не подключён');
}

/** Выход: сессия и полка дневников этого устройства очищаются. */
export async function signOut(): Promise<void> {}

/** Заголовок Authorization: Bearer <token>, если человек вошёл; иначе пусто. */
export function authHeaders(): Record<string, string> {
  return {};
}

/** Адреса страниц входа (страница, куда вернуть после входа, — в ?next=). */
export const AUTH_ROUTES = { signup: '/signup', login: '/login', home: '/home' } as const;
export const loginUrl = (next?: string) => `${AUTH_ROUTES.login}${next ? `?next=${encodeURIComponent(next)}` : ''}`;
