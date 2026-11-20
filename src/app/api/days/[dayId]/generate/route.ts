import type { NextRequest } from 'next/server';
import { isUuid } from '@/lib/db';
import { generateDay } from '@/lib/generateDay';
import { realDeps } from '@/lib/generateDeps';
import { handle, HttpError, readJson } from '@/lib/http';
import { withUrls } from '@/lib/db';
import { revealable } from '@/lib/capsule';
import { GenerateBody } from '@/lib/validation';

export const maxDuration = 60;

export const POST = handle(async (req: NextRequest, ctx: RouteContext<'/api/days/[dayId]/generate'>) => {
  const { dayId } = await ctx.params;
  if (!isUuid(dayId)) throw new HttpError(404, 'День не найден');
  const body = GenerateBody.parse(await readJson(req));
  const day = await generateDay(dayId, body, realDeps());
  const [signed] = await withUrls([day]);
  return Response.json(revealable(signed));
});
