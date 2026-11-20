// Фото для доски: подписанная ссылка на загрузку в папку дневника.
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { demoDiaryId, isDiaryId, ownsDiary } from '@/lib/db';
import { handle, HttpError } from '@/lib/http';
import { signRead, signUpload } from '@/lib/storage';

export const POST = handle(async (req: NextRequest, ctx: RouteContext<'/api/diaries/[diaryId]/board/upload'>) => {
  const { diaryId } = await ctx.params;
  if (!isDiaryId(diaryId) || diaryId === demoDiaryId()) throw new HttpError(403, 'Нельзя загрузить фото в этот дневник');
  if (!ownsDiary(req, diaryId)) throw new HttpError(403, 'Добавлять фото может только владелец дневника');
  const path = `${diaryId}/_board/${randomUUID()}.jpg`;
  const signed = await signUpload(path);
  const read = await signRead([path], 6 * 3600);
  return Response.json({ ...signed, readUrl: read[path] ?? null });
});
