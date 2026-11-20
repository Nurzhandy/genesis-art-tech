// Содержимое папки дня с размерами файлов — для панели «Папка дня» (A8).
import type { NextRequest } from 'next/server';
import { getDayRow, isUuid } from '@/lib/db';
import { isSealed, serverToday } from '@/lib/capsule';
import { handle, HttpError } from '@/lib/http';
import { dayFolder, listFolder } from '@/lib/storage';

export const GET = handle(async (_req: NextRequest, ctx: RouteContext<'/api/days/[dayId]/files'>) => {
  const { dayId } = await ctx.params;
  const day = isUuid(dayId) ? await getDayRow(dayId) : null;
  if (!day || day.status !== 'ready') throw new HttpError(404, 'День не найден или ещё не собран');
  if (isSealed(day, serverToday())) throw new HttpError(403, 'Капсула ещё запечатана');
  const folder = dayFolder(day.diaryId, day.date, day.slug, day.id);
  const files = await listFolder(folder);
  return Response.json({
    folder: folder.slice(folder.indexOf('/') + 1),
    files: files.map((f) => ({ name: f.path.slice(folder.length + 1), size: f.size })),
  });
});
