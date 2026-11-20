// Один дневник: карточка и переименование (спека 2026-11-20).
import type { NextRequest } from 'next/server';
import { demoDiaryId, isDiaryId, ownsDiary } from '@/lib/db';
import { diaryMetas } from '@/lib/diaries';
import { handle, HttpError, readJson } from '@/lib/http';
import { RenameDiaryInput } from '@/lib/shelf';
import { supabaseAdmin } from '@/lib/supabase/server';

async function meta(id: string) {
  const [m] = isDiaryId(id) ? await diaryMetas([id]) : [];
  if (!m) throw new HttpError(404, 'Дневник не найден');
  return m;
}

export const GET = handle(async (_req: NextRequest, ctx: RouteContext<'/api/diaries/[diaryId]'>) => {
  const { diaryId } = await ctx.params;
  return Response.json(await meta(diaryId));
});

export const PATCH = handle(async (req: NextRequest, ctx: RouteContext<'/api/diaries/[diaryId]'>) => {
  const { diaryId } = await ctx.params;
  await meta(diaryId);
  if (diaryId === demoDiaryId() && process.env.ALLOW_DEMO_WRITES !== '1') throw new HttpError(403, 'Демо-дневник только для просмотра');
  if (!ownsDiary(req, diaryId)) throw new HttpError(403, 'Переименовать дневник может только владелец');
  const { title } = RenameDiaryInput.parse(await readJson(req));
  const { error } = await supabaseAdmin().from('diaries').update({ title }).eq('id', diaryId);
  if (error) throw error;
  return Response.json(await meta(diaryId));
});
