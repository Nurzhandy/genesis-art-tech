// Фото и голосовые (?ext=webm) для доски дня: подписанная ссылка на загрузку в папку доски этого дня (только владелец).
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { assertCanEdit } from '@/lib/db';
import { dayBoardFolder, loadDayBoard } from '@/lib/dayBoard';
import { handle } from '@/lib/http';
import { signRead, signUpload } from '@/lib/storage';
import { boardFileExt } from '@/lib/board/board';

export const POST = handle(async (req: NextRequest, ctx: RouteContext<'/api/days/[dayId]/board/upload'>) => {
  const { dayId } = await ctx.params;
  const { day } = await loadDayBoard(dayId);
  assertCanEdit(req, day);
  const path = `${dayBoardFolder(day.diaryId, day.id)}/${randomUUID()}.${boardFileExt(req.nextUrl.searchParams.get('ext'))}`;
  const signed = await signUpload(path);
  const read = await signRead([path], 6 * 3600);
  return Response.json({ ...signed, readUrl: read[path] ?? null });
});
