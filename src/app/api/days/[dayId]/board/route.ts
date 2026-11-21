// Доска дня (план 21.11): прочитать (все, кроме запечатанной капсулы) и сохранить (только владелец).
import type { NextRequest } from 'next/server';
import { isSealed, serverToday } from '@/lib/capsule';
import { assertCanEdit } from '@/lib/db';
import { assertOwnPhotos, loadDayBoard } from '@/lib/dayBoard';
import { BoardSchema, MAX_BOARD_BYTES } from '@/lib/board/board';
import { handle, HttpError } from '@/lib/http';
import { signRead } from '@/lib/storage';
import { supabaseAdmin } from '@/lib/supabase/server';

export const GET = handle(async (_req: NextRequest, ctx: RouteContext<'/api/days/[dayId]/board'>) => {
  const { dayId } = await ctx.params;
  const { day, board } = await loadDayBoard(dayId);
  if (isSealed(day, serverToday())) throw new HttpError(409, 'Капсула ещё запечатана');
  const urls = await signRead(board.items.flatMap((i) => (i.kind === 'photo' ? [i.path] : [])), 6 * 3600);
  return Response.json({ board, urls, day: { id: day.id, diaryId: day.diaryId, date: day.date, place: day.place ?? null, status: day.status, title: day.title } });
});

export const PUT = handle(async (req: NextRequest, ctx: RouteContext<'/api/days/[dayId]/board'>) => {
  const { dayId } = await ctx.params;
  const { day } = await loadDayBoard(dayId);
  assertCanEdit(req, day);
  if (isSealed(day, serverToday())) throw new HttpError(409, 'Капсула ещё запечатана');
  if (day.status === 'generating') throw new HttpError(409, 'День сейчас собирается');
  const raw = await req.text();
  if (raw.length > MAX_BOARD_BYTES) throw new HttpError(400, 'Доска слишком большая — уберите часть рисунков');
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'Тело запроса должно быть JSON'); }
  const board = BoardSchema.parse(body);
  assertOwnPhotos(board, day);
  const { error } = await supabaseAdmin().from('days').update({ board }).eq('id', dayId);
  if (error) throw error;
  return Response.json({ ok: true });
});
