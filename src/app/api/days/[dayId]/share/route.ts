// Ссылка-подарок (план 20.11, A4): создать или отозвать. Только владелец дневника.
// Файлы дня копируются в папку подарка: в подписанных ссылках гостя нет id дневника (ключа владельца).
import type { NextRequest } from 'next/server';
import { isSealed, serverToday } from '@/lib/capsule';
import { assertCanEdit, getDayRow, isUuid, updateDay } from '@/lib/db';
import type { DayRecord } from '@/lib/types';
import { handle, HttpError } from '@/lib/http';
import { clearShared, newShareId, sharedCopy } from '@/lib/share';
import { copyFile } from '@/lib/storage';

async function load(ctx: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await ctx.params;
  const day = isUuid(dayId) ? await getDayRow(dayId) : null;
  if (!day) throw new HttpError(404, 'День не найден');
  return day;
}

/** Свежие копии: после «Не совсем так?» или нового постера подарок показывает актуальный день. */
async function syncShared(day: DayRecord, shareId: string) {
  await clearShared(shareId);
  for (const [from, to] of sharedCopy(day, shareId).pairs) {
    await copyFile(from, to).catch(() => undefined);   // постера может ещё не быть — это не ошибка
  }
}

export const POST = handle(async (req: NextRequest, ctx: RouteContext<'/api/days/[dayId]/share'>) => {
  const day = await load(ctx);
  assertCanEdit(req, day);
  if (day.status !== 'ready') throw new HttpError(409, 'День ещё не собран');
  if (isSealed(day, serverToday())) throw new HttpError(409, 'Капсулой можно поделиться, когда она откроется');
  const shareId = day.shareId ?? newShareId();
  await syncShared(day, shareId);
  if (!day.shareId) await updateDay(day.id, { share_id: shareId });
  return Response.json({ shareId, path: `/s/${shareId}` });
});

export const DELETE = handle(async (req: NextRequest, ctx: RouteContext<'/api/days/[dayId]/share'>) => {
  const day = await load(ctx);
  assertCanEdit(req, day);
  if (day.shareId) {
    await updateDay(day.id, { share_id: null });
    await clearShared(day.shareId);
  }
  return new Response(null, { status: 204 });
});
