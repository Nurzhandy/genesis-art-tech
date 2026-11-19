// Песня по ссылке: oEmbed (имя), Deezer (bpm, превью, год) и слияние источников музыки (A5).
import type { DayAnalysis, MusicFeatures, SongRef } from '@/lib/types';
import { parseSongUrl } from './parseSongUrl';

export type Fetcher = (url: string) => Promise<Response>;

const withTimeout: Fetcher = (url) => fetch(url, { signal: AbortSignal.timeout(5000), headers: { accept: 'application/json' } });

async function getJson<T>(fetcher: Fetcher, url: string): Promise<T | null> {
  try {
    const res = await fetcher(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** «Artist - Title (Official Video)» → { artist, title } */
export function splitYoutubeTitle(raw: string, author?: string): { artist?: string; title?: string } {
  const cleaned = raw.replace(/\s*[([](official|lyric|audio|video|mv|hd|4k|клип|премьера)[^)\]]*[)\]]/gi, '').trim();
  const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(cleaned);
  if (m) return { artist: m[1].trim(), title: m[2].trim() };
  return { artist: author?.replace(/\s*-\s*Topic$/, '').trim(), title: cleaned };
}

interface DeezerTrack { id: number; bpm?: number; preview?: string; release_date?: string; title?: string; artist?: { name: string }; album?: { cover_medium?: string } }

async function deezerLookup(fetcher: Fetcher, artist?: string, title?: string, id?: string): Promise<DeezerTrack | null> {
  let trackId = id;
  if (!trackId) {
    if (!title) return null;
    const q = artist ? `${artist} ${title}` : title; // расширенный синтаксис artist:"" из KZ возвращает пусто
    const search = await getJson<{ data?: DeezerTrack[] }>(fetcher, `https://api.deezer.com/search?limit=1&q=${encodeURIComponent(q)}`);
    trackId = search?.data?.[0]?.id?.toString();
    if (!trackId) return null;
  }
  return getJson<DeezerTrack>(fetcher, `https://api.deezer.com/track/${trackId}`);
}

export async function resolveSong(url: string, fetcher: Fetcher = withTimeout): Promise<{ song: SongRef; music: MusicFeatures | null }> {
  const parsed = parseSongUrl(url);
  if (!parsed) throw new Error('Это не похоже на ссылку на песню');
  const song: Extract<SongRef, { kind: 'link' }> = { kind: 'link', url, provider: parsed.provider, embedUrl: parsed.embedUrl };

  if (parsed.provider === 'spotify') {
    const o = await getJson<{ title?: string; author_name?: string }>(fetcher, `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
    if (o?.title) song.title = o.title;
    if (o?.author_name) song.artist = o.author_name;
  } else if (parsed.provider === 'youtube') {
    const o = await getJson<{ title?: string; author_name?: string }>(fetcher, `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    if (o?.title) Object.assign(song, splitYoutubeTitle(o.title, o.author_name));
  }

  const track = await deezerLookup(fetcher, song.artist, song.title, parsed.provider === 'deezer' ? parsed.id : undefined);
  if (!track) return { song, music: null };

  song.title ??= track.title;
  song.artist ??= track.artist?.name;
  if (track.preview) song.previewUrl = `/api/music/preview?id=${track.id}`;
  if (track.album?.cover_medium) song.coverUrl = track.album.cover_medium;
  const year = track.release_date ? Number(track.release_date.slice(0, 4)) : undefined;
  if (year && year > 1900) song.year = year;

  const music: MusicFeatures = { source: 'deezer', bpm: track.bpm ?? 0, energy: 0.5, mode: 'unknown', ...(song.year ? { year: song.year } : {}) };
  return { song, music };
}

const NEUTRAL: MusicFeatures = { source: 'llm', bpm: 90, energy: 0.5, mode: 'unknown' };

/** audio > deezer > оценка модели > нейтральное. Лад, жанр и год дополняются из оценки модели. */
export function mergeMusic(audio: MusicFeatures | null, deezer: MusicFeatures | null, guess: DayAnalysis['songGuess']): MusicFeatures {
  const deezerOk = deezer && deezer.bpm > 0 ? deezer : null;
  const base: MusicFeatures | null = audio ?? deezerOk ?? (guess ? { source: 'llm', bpm: guess.bpm, energy: guess.energy, mode: guess.mode } : null);
  if (!base) return { ...NEUTRAL };
  const out: MusicFeatures = { ...base };
  // У Deezer нет энергии — для него лучше оценка модели.
  if (base.source === 'deezer' && guess) out.energy = guess.energy;
  if (out.mode === 'unknown' && guess) out.mode = guess.mode;
  const genre = base.genre ?? guess?.genre;
  const year = guess?.year ?? base.year ?? deezer?.year; // Deezer часто отдаёт год ремастера
  if (genre) out.genre = genre;
  if (year) out.year = year;
  return out;
}
