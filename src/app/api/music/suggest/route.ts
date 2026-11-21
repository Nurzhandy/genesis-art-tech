// Песни под настроение фото: топ жанра Deezer, только треки с официальным 30-секундным превью.
import type { NextRequest } from 'next/server';
import { handle, HttpError } from '@/lib/http';
import { VIBES, type Vibe } from '@/lib/videoVibe';

interface DeezerTrack { id: number; title?: string; preview?: string; artist?: { name?: string }; album?: { cover_medium?: string } }

export const GET = handle(async (req: NextRequest) => {
  const vibe = req.nextUrl.searchParams.get('vibe') as Vibe;
  const seed = Number(req.nextUrl.searchParams.get('seed') ?? 0) || 0;
  if (!VIBES[vibe]) throw new HttpError(400, 'Неизвестное настроение');
  try {
    const res = await fetch(`https://api.deezer.com/chart/${VIBES[vibe].genre}/tracks?limit=30`, { signal: AbortSignal.timeout(6000) });
    const data = ((await res.json()) as { data?: DeezerTrack[] }).data ?? [];
    const ok = data.filter((t) => t.preview && t.title);
    // Разные фото — разные предложения, но одни и те же фото — те же песни.
    const start = ok.length ? seed % ok.length : 0;
    const pick = [...ok.slice(start), ...ok.slice(0, start)].slice(0, 3);
    return Response.json({
      tracks: pick.map((t) => ({
        id: t.id, title: t.title, artist: t.artist?.name ?? '', cover: t.album?.cover_medium ?? null,
        previewUrl: `/api/music/preview?id=${t.id}`, url: `https://www.deezer.com/track/${t.id}`,
      })),
    });
  } catch {
    return Response.json({ tracks: [] });
  }
});
