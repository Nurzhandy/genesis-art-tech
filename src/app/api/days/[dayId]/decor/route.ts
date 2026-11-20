// Украшения страницы дня (спека 2026-11-20): стикеры, текст, кисть. Только владелец, не капсула.
import type { NextRequest } from 'next/server';
import { isSealed, serverToday } from '@/lib/capsule';
import { assertCanEdit, getDayRow, isUuid, updateDay, withUrls } from '@/lib/db';
import { DecorSchema, MAX_DECOR_BYTES } from '@/lib/decor/decor';
import { handle, HttpError } from '@/lib/http';
import { dayFolder, putFile } from '@/lib/storage';

export const PUT = handle(async (req: NextRequest, ctx: RouteContext<'/api/days/[dayId]/decor'>) => {
  const { dayId } = await ctx.params;
  const day = isUuid(dayId) ? await getDayRow(dayId) : null;
  if (!day) throw new HttpError(404, 'День не найден');
  assertCanEdit(req, day);
  if (day.status !== 'ready') throw new HttpError(409, 'День ещё не собран');
  if (isSealed(day, serverToday())) throw new HttpError(409, 'Капсула ещё запечатана');
  const raw = await req.text();
  if (raw.length > MAX_DECOR_BYTES) throw new HttpError(400, 'Слишком много украшений — уберите часть рисунка');
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'Тело запроса должно быть JSON'); }
  const decor = DecorSchema.parse(body);
  const folder = dayFolder(day.diaryId, day.date, day.slug, day.id);
  await putFile(`${folder}/decor.json`, JSON.stringify(decor, null, 2), 'application/json');
  // Постер со старыми украшениями больше не похож на день: плеер нарисует и сохранит новый.
  const updated = await updateDay(day.id, { decor, poster_path: null });
  const [signed] = await withUrls([updated]);
  return Response.json(signed);
});
