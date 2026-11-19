import type { NextRequest } from 'next/server';
import { getDayRow, isUuid, withUrls } from '@/lib/db';
import { handle, HttpError } from '@/lib/http';
import { supabaseAdmin } from '@/lib/supabase/server';

export const GET = handle(async (_req: NextRequest, ctx: RouteContext<'/api/days/[dayId]'>) => {
  const { dayId } = await ctx.params;
  const day = isUuid(dayId) ? await getDayRow(dayId) : null;
  if (!day) throw new HttpError(404, 'День не найден');
  const [withSigned] = await withUrls([day]);
  if (day.status === 'ready') {
    const { count } = await supabaseAdmin().from('days').select('id', { count: 'exact', head: true })
      .eq('diary_id', day.diaryId).eq('status', 'ready').lte('date', day.date);
    withSigned.dayNumber = count ?? undefined;
  }
  return Response.json(withSigned);
});
