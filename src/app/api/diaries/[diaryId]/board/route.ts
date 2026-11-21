// Свободная доска дневника: прочитать (все) и сохранить (только владелец).
import type { NextRequest } from 'next/server';
import { demoDiaryId, isDiaryId, ownsDiary } from '@/lib/db';
import { boardFilePaths, BoardSchema, MAX_BOARD_BYTES, normalizeBoard } from '@/lib/board/board';
import { handle, HttpError } from '@/lib/http';
import { signRead } from '@/lib/storage';
import { supabaseAdmin } from '@/lib/supabase/server';

async function load(diaryId: string) {
  if (!isDiaryId(diaryId)) throw new HttpError(404, 'Дневник не найден');
  const { data, error } = await supabaseAdmin().from('diaries').select('board').eq('id', diaryId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Дневник не найден');
  return normalizeBoard(data.board);
}

export const GET = handle(async (_req: NextRequest, ctx: RouteContext<'/api/diaries/[diaryId]/board'>) => {
  const { diaryId } = await ctx.params;
  const board = await load(diaryId);
  // Фото и голосовые доски лежат в закрытом хранилище: отдаём подписанные ссылки.
  const urls = await signRead(boardFilePaths(board), 6 * 3600);
  return Response.json({ board, urls });
});

export const PUT = handle(async (req: NextRequest, ctx: RouteContext<'/api/diaries/[diaryId]/board'>) => {
  const { diaryId } = await ctx.params;
  await load(diaryId);
  if (diaryId === demoDiaryId() && process.env.ALLOW_DEMO_WRITES !== '1') throw new HttpError(403, 'Демо-дневник только для просмотра');
  if (!ownsDiary(req, diaryId)) throw new HttpError(403, 'Менять доску может только владелец дневника');
  const raw = await req.text();
  if (raw.length > MAX_BOARD_BYTES) throw new HttpError(400, 'Доска слишком большая — уберите часть рисунков');
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'Тело запроса должно быть JSON'); }
  const board = BoardSchema.parse(body);
  // Фото и голосовые — только из папки этого дневника.
  if (boardFilePaths(board).some((p) => !p.startsWith(`${diaryId}/_board/`) || p.includes('..'))) throw new HttpError(400, 'Чужой файл на доске');
  const { error } = await supabaseAdmin().from('diaries').update({ board }).eq('id', diaryId);
  if (error) throw error;
  return Response.json({ ok: true });
});
