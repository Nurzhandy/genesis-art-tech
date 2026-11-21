import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { diaryMetas } from '@/lib/diaries';
import { requestUser } from '@/lib/auth';
import { handle } from '@/lib/http';
import { DIARY_KINDS, NewDiaryInput } from '@/lib/shelf';
import { supabaseAdmin } from '@/lib/supabase/server';

/** Новый дневник: название и вид (спека 2026-11-20). Без тела — «Мои дни», как раньше.
 *  Доступ для всех (21.11): дневник можно завести и без аккаунта — он живёт на полке устройства, как раньше.
 *  Если человек вошёл, дневник сразу получает владельца и открывается на любом его устройстве. */
export const POST = handle(async (req: NextRequest) => {
  const user = await requestUser(req);
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
