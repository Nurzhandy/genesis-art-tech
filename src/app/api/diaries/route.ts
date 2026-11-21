import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { diaryMetas } from '@/lib/diaries';
import { requestUser } from '@/lib/auth';
import { handle, HttpError } from '@/lib/http';
import { DIARY_KINDS, NewDiaryInput } from '@/lib/shelf';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isLocalMode } from '@/lib/supabase/local';

/** Новый дневник: название и вид (спека 2026-11-20). Без тела — «Мои дни», как раньше.
 *  С аккаунтами (план 21.11, часть A): завести дневник можно только после входа, он сразу получает владельца.
 *  В локальном режиме без Supabase аккаунтов нет — дневник заводится как раньше. */
export const POST = handle(async (req: NextRequest) => {
  const user = await requestUser(req);
  if (!user && !isLocalMode()) throw new HttpError(401, 'Чтобы завести дневник, войдите или зарегистрируйтесь');
  const body: unknown = await req.json().catch(() => ({}));
  const input = body && typeof body === 'object' && 'title' in body
    ? NewDiaryInput.parse(body)
    : { title: DIARY_KINDS.memories.defaultTitle, kind: 'memories' as const };
  const id = randomUUID();
  const { error } = await supabaseAdmin().from('diaries').insert({ id, title: input.title, kind: input.kind, ...(user ? { owner_id: user.id } : {}) });
  if (error) throw error;
  return Response.json({ diaryId: id }, { status: 201 });
});

/** Карточки полки: только те дневники, ключи которых прислал браузер. */
export const GET = handle(async (req: NextRequest) => {
  const ids = (req.nextUrl.searchParams.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return Response.json(await diaryMetas(ids));
});
