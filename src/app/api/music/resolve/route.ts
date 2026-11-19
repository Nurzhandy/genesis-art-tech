import type { NextRequest } from 'next/server';
import { handle, HttpError } from '@/lib/http';
import { resolveSong } from '@/lib/music/resolve';

export const GET = handle(async (req: NextRequest) => {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) throw new HttpError(400, 'Нужна ссылка на песню');
  try {
    return Response.json(await resolveSong(url));
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : 'Не удалось распознать ссылку');
  }
});
