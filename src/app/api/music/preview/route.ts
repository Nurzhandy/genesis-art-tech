// Прокси официального 30-секундного превью Deezer: свежая ссылка + CORS для анализа звука в браузере.
import type { NextRequest } from 'next/server';
import { fail } from '@/lib/http';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!/^\d{1,15}$/.test(id)) return fail(400, 'Неверный id трека');
  try {
    const track = await fetch(`https://api.deezer.com/track/${id}`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json());
    if (!track?.preview) return fail(404, 'У трека нет превью');
    const audio = await fetch(track.preview, { signal: AbortSignal.timeout(10000) });
    if (!audio.ok || !audio.body) return fail(502, 'Превью недоступно');
    return new Response(audio.body, {
      headers: {
        'content-type': audio.headers.get('content-type') ?? 'audio/mpeg',
        'cache-control': 'public, max-age=600',
        'access-control-allow-origin': '*',
      },
    });
  } catch {
    return fail(502, 'Превью недоступно');
  }
}
