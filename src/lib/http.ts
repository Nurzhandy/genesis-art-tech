// Ответы API: единый формат ошибок { error }.
import { z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const fail = (status: number, message: string) => Response.json({ error: message }, { status });

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      if (e instanceof z.ZodError) return fail(400, 'Неверные данные: ' + e.issues.map((i) => i.path.join('.') || i.message).join(', '));
      // Нет ключей базы (частый случай локально без .env.local) — говорим прямо, а не «что-то пошло не так».
      if (e instanceof Error && e.message.startsWith('Supabase не настроен')) {
        return fail(503, 'База дневника не подключена: сохранять дни пока нельзя. Локально добавьте ключи Supabase в .env.local, на сайте это работает.');
      }
      console.error(e);
      return fail(500, 'Не получилось сохранить: сервер ответил ошибкой. Попробуйте ещё раз через минуту.');
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { throw new HttpError(400, 'Тело запроса должно быть JSON'); }
}
