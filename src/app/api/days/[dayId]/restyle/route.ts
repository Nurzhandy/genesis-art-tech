// «Не совсем так?» (R10): поправка настроения → тот же движок правил, без нового вызова модели.
import type { NextRequest } from 'next/server';
import { assertCanEdit, getDayRow, isUuid, updateDay, withUrls } from '@/lib/db';
import { MoodOverrideInput, restyle } from '@/lib/dayEdits';
import { handle, HttpError, readJson } from '@/lib/http';
import { dayFiles, dayFolder, putFile } from '@/lib/storage';
import { buildStyle } from '@/lib/style/buildStyle';

export const POST = handle(async (req: NextRequest, ctx: RouteContext<'/api/days/[dayId]/restyle'>) => {
  const { dayId } = await ctx.params;
  const day = isUuid(dayId) ? await getDayRow(dayId) : null;
  if (!day) throw new HttpError(404, 'День не найден');
  assertCanEdit(req, day);
  const override = MoodOverrideInput.parse(await readJson(req));
  const { style, moodOverride } = restyle(day, override, buildStyle);

  await putFile(dayFiles(dayFolder(day.diaryId, day.date, day.slug, day.id)).json('style'), JSON.stringify(style, null, 2), 'application/json');
  // Постер старого стиля больше не похож на день: плеер нарисует и сохранит новый.
  const updated = await updateDay(day.id, { style, mood_override: moodOverride, poster_path: null });
  const [signed] = await withUrls([updated]);
  return Response.json(signed);
});
