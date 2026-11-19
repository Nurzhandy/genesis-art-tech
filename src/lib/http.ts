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
      console.error(e);
      return fail(500, 'Что-то пошло не так. Попробуйте ещё раз.');
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { throw new HttpError(400, 'Тело запроса должно быть JSON'); }
}
