import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { diaryMetas } from '@/lib/diaries';
import { handle } from '@/lib/http';
import { DIARY_KINDS, NewDiaryInput } from '@/lib/shelf';
import { supabaseAdmin } from '@/lib/supabase/server';

/** Новый дневник: название и вид (спека 2026-11-20). Без тела — «Мои дни», как раньше. */
export const POST = handle(async (req: NextRequest) => {
  const body: unknown = await req.json().catch(() => ({}));
  const input = body && typeof body === 'object' && 'title' in body
    ? NewDiaryInput.parse(body)
    : { title: DIARY_KINDS.memories.defaultTitle, kind: 'memories' as const };
  const id = randomUUID();
  const { error } = await supabaseAdmin().from('diaries').insert({ id, title: input.title, kind: input.kind });
  if (error) throw error;
  return Response.json({ diaryId: id }, { status: 201 });
});

/** Карточки полки: только те дневники, ключи которых прислал браузер. */
export const GET = handle(async (req: NextRequest) => {
  const ids = (req.nextUrl.searchParams.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return Response.json(await diaryMetas(ids));
});
