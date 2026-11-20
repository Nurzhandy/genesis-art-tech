// Прокси обложки: тот же origin, чтобы холст воспоминания можно было сохранить постером.
import type { NextRequest } from 'next/server';
import { fail } from '@/lib/http';
import { isAllowedCoverUrl } from '@/lib/music/cover';

const MAX_BYTES = 2 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') ?? '';
  if (!isAllowedCoverUrl(url)) return fail(400, 'Эта ссылка не похожа на обложку альбома');
  try {
    const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000) });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.startsWith('image/')) return fail(502, 'Обложка недоступна');
    const body = await res.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return fail(413, 'Обложка слишком большая');
    return new Response(body, { headers: { 'content-type': type, 'cache-control': 'public, max-age=86400, immutable' } });
  } catch {
    return fail(502, 'Обложка недоступна');
  }
}
