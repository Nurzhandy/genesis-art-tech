// Распознавание ссылки на песню: сервис, id трека, embed (A5).
import type { SongProvider } from '@/lib/types';

export interface ParsedSong { provider: SongProvider; id?: string; embedUrl?: string }

export function parseSongUrl(raw: string): ParsedSong | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^www\./, '');
  const path = u.pathname;

  if (host === 'open.spotify.com') {
    const m = /\/track\/([A-Za-z0-9]+)/.exec(path);
    return m ? { provider: 'spotify', id: m[1], embedUrl: `https://open.spotify.com/embed/track/${m[1]}` } : { provider: 'spotify' };
  }
  if (host === 'youtu.be' || host.endsWith('youtube.com')) {
    const id = host === 'youtu.be' ? path.slice(1).split('/')[0] : u.searchParams.get('v') ?? /\/(?:shorts|embed)\/([\w-]{11})/.exec(path)?.[1];
    return id ? { provider: 'youtube', id, embedUrl: `https://www.youtube.com/embed/${id}` } : { provider: 'youtube' };
  }
  if (host.startsWith('music.yandex.')) {
    const m = /\/track\/(\d+)/.exec(path);
    return { provider: 'yandex', id: m?.[1] };
  }
  if (host === 'deezer.com' || host.endsWith('.deezer.com') || host === 'deezer.page.link') {
    const m = /\/track\/(\d+)/.exec(path);
    return { provider: 'deezer', id: m?.[1], embedUrl: m ? `https://widget.deezer.com/widget/auto/track/${m[1]}` : undefined };
  }
  if (host === 'music.apple.com') return { provider: 'apple', id: u.searchParams.get('i') ?? undefined };
  if (host === 'soundcloud.com' || host.endsWith('.soundcloud.com')) return { provider: 'soundcloud' };
  return { provider: 'other' };
}
