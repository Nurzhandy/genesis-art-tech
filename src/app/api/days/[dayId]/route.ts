import type { NextRequest } from 'next/server';
import { getDayRow, isUuid, withUrls } from '@/lib/db';
import { handle, HttpError } from '@/lib/http';

export const GET = handle(async (_req: NextRequest, ctx: RouteContext<'/api/days/[dayId]'>) => {
  const { dayId } = await ctx.params;
  const day = isUuid(dayId) ? await getDayRow(dayId) : null;
  if (!day) throw new HttpError(404, 'День не найден');
  const [withSigned] = await withUrls([day]);
  return Response.json(withSigned);
});
