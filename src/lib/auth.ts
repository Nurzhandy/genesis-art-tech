// Кто прислал запрос (план 21.11, часть A): токен Supabase Auth из заголовка Authorization: Bearer <token>.
// Только на сервере. В локальном режиме (без ключей Supabase) аккаунтов нет — всегда null.
import { HttpError } from './http';
import { supabaseAdmin } from './supabase/server';
import { isLocalMode } from './supabase/local';

export interface RequestUser { id: string; email: string }

export async function requestUser(req: Request): Promise<RequestUser | null> {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '');
  if (!m || isLocalMode()) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(m[1]);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? '' };
}

export async function requireUser(req: Request): Promise<RequestUser> {
  const u = await requestUser(req);
  if (!u) throw new HttpError(401, 'Войдите в аккаунт');
  return u;
}
