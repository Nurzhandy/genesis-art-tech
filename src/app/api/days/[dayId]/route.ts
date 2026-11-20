import type { NextRequest } from 'next/server';
import { assertCanEdit, getDayRow, isUuid, updateDay, withUrls } from '@/lib/db';
import { revealable } from '@/lib/capsule';
import { clearShared } from '@/lib/share';
import { deleteDay, RenameInput, renameDay } from '@/lib/dayEdits';
import { realDeps } from '@/lib/generateDeps';
import { handle, HttpError, readJson } from '@/lib/http';
import { listFolder, moveFile, putFile, removeFiles } from '@/lib/storage';
import { supabaseAdmin } from '@/lib/supabase/server';

async function load(ctx: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await ctx.params;
  const day = isUuid(dayId) ? await getDayRow(dayId) : null;
  if (!day) throw new HttpError(404, 'День не найден');
  return day;
}

export const GET = handle(async (_req: NextRequest, ctx: RouteContext<'/api/days/[dayId]'>) => {
  const day = await load(ctx);
  const [withSigned] = await withUrls([day]);
  if (day.status === 'ready') {
    const { count } = await supabaseAdmin().from('days').select('id', { count: 'exact', head: true })
      .eq('diary_id', day.diaryId).eq('status', 'ready').lte('date', day.date);
    withSigned.dayNumber = count ?? undefined;
  }
  return Response.json(revealable(withSigned));
});

/** Переименовать папку дня (R11): название по тем же правилам, папка в Storage переезжает. */
export const PATCH = handle(async (req: NextRequest, ctx: RouteContext<'/api/days/[dayId]'>) => {
  const day = await load(ctx);
  assertCanEdit(req, day);
  const { title } = RenameInput.parse(await readJson(req));
  const { slugTaken } = realDeps();
  const renamed = await renameDay(day, title, { slugTaken, listFolder, moveFile, putFile, updateDay });
  const [signed] = await withUrls([renamed]);
  return Response.json(revealable(signed));
});

/** Удалить день (R14): все файлы папки и запись. */
export const DELETE = handle(async (req: NextRequest, ctx: RouteContext<'/api/days/[dayId]'>) => {
  const day = await load(ctx);
  assertCanEdit(req, day);
  await deleteDay(day, {
    listFolder,
    removeFiles,
    async deleteRow(id) {
      const { error } = await supabaseAdmin().from('days').delete().eq('id', id);
      if (error) throw error;
    },
  });
  if (day.shareId) await clearShared(day.shareId).catch(() => undefined);   // копии подарка тоже
  return new Response(null, { status: 204 });
});
