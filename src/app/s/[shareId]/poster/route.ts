// Постер дня для превью ссылки в мессенджерах: всегда свежая подписанная ссылка (план 20.11, A4).
import type { NextRequest } from 'next/server';
import { serverToday } from '@/lib/capsule';
import { getDayByShare } from '@/lib/db';
import { SHARE_ID, sharedCopy, sharedOrNull } from '@/lib/share';
import { signRead } from '@/lib/storage';

export async function GET(_req: NextRequest, ctx: RouteContext<'/s/[shareId]/poster'>) {
  const { shareId } = await ctx.params;
  const day = SHARE_ID.test(shareId) ? sharedOrNull(await getDayByShare(shareId), shareId, serverToday()) : null;
  if (!day) return new Response('Not found', { status: 404 });
  // Только копии из папки подарка: в путях файлов дневника — ключ владельца.
  const copy = sharedCopy(day, shareId).day;
  const candidates = [copy.posterPath, copy.photos[0]?.thumbPath].filter((p): p is string => !!p);
  const urls = await signRead(candidates, 3600);
  const url = candidates.map((p) => urls[p]).find(Boolean);
  if (!url) return new Response('Not found', { status: 404 });
  return new Response(null, { status: 302, headers: { location: url, 'cache-control': 'public, max-age=600' } });
}
