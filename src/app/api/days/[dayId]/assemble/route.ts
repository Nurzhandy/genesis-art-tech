// «Собрать день» с доски дня (план 21.11). Повторный вызов — «Пересобрать день».
import type { NextRequest } from 'next/server';
import { assembleDay } from '@/lib/assembleDay';
import { revealable, isSealed, serverToday } from '@/lib/capsule';
import { assertCanEdit, updateDay, withUrls } from '@/lib/db';
import { loadDayBoard } from '@/lib/dayBoard';
import { generateDay } from '@/lib/generateDay';
import { realDeps } from '@/lib/generateDeps';
import { handle, HttpError, readJson } from '@/lib/http';
import { copyFile, removeFiles } from '@/lib/storage';
import { AssembleBody } from '@/lib/validation';

export const maxDuration = 60;

export const POST = handle(async (req: NextRequest, ctx: RouteContext<'/api/days/[dayId]/assemble'>) => {
  const { dayId } = await ctx.params;
  const body = AssembleBody.parse(await readJson(req));
  const deps = realDeps();
  const day = await assembleDay(dayId, body, {
    load: loadDayBoard, updateDay, copyFile, removeFiles,
    generate: (id, b) => generateDay(id, b, deps),
    limitReached: async (diaryId) => (await deps.recentGenerations(diaryId)) >= deps.limit,
  }, (d) => {
    assertCanEdit(req, d);
    if (isSealed(d, serverToday())) throw new HttpError(409, 'Капсула ещё запечатана');
  });
  const [signed] = await withUrls([day]);
  return Response.json(revealable(signed));
});
