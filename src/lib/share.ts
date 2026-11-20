// Поделиться днём как подарком (план 20.11, A4): ссылка /s/<shareId> только на просмотр.
// diaryId — это ключ владельца, а по id дня API отдаёт diaryId, поэтому ни то ни другое наружу не уходит.
import { randomInt } from 'node:crypto';
import { isSealed } from './capsule';
import { urlPaths } from './db';
import { dayFolder, listFolder, removeFiles } from './storage';
import type { DayRecord } from './types';

const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
export const SHARE_ID = /^[2-9a-km-zA-HJ-NP-Z]{10}$/;

export function newShareId(): string {
  let s = '';
  for (let i = 0; i < 10; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/** Можно ли сейчас показать день по ссылке: есть, собран, ссылку не отозвали, не капсула. */
export function sharedOrNull(day: DayRecord | null, shareId: string, today: string): DayRecord | null {
  if (!day || day.status !== 'ready' || !day.shareId || day.shareId !== shareId) return null;
  return isSealed(day, today) ? null : day;
}

/**
 * Папка подарка. Пути в хранилище начинаются с id дневника, а подписанная ссылка содержит путь, поэтому
 * гость получает копии файлов дня в отдельной папке — в его ссылках есть только shareId.
 */
export const shareFolder = (shareId: string) => `_shared/${shareId}`;

/** Убрать копии подарка (ссылку отозвали или день удалили). */
export async function clearShared(shareId: string): Promise<void> {
  const old = await listFolder(shareFolder(shareId)).catch(() => []);
  if (old.length) await removeFiles(old.map((f) => f.path));
}

/** Файлы дня → их копии в папке подарка, и день, где пути уже указывают на копии. */
export function sharedCopy(day: DayRecord, shareId: string): { pairs: [string, string][]; day: DayRecord } {
  const from = dayFolder(day.diaryId, day.date, day.slug, day.id);
  const to = shareFolder(shareId);
  const re = (p: string) => (p.startsWith(from + '/') ? to + p.slice(from.length) : '');
  const pairs = urlPaths(day).map((p) => [p, re(p)] as [string, string]).filter(([, t]) => t);
  return {
    pairs,
    day: {
      ...day,
      photos: day.photos.map((p) => ({ ...p, path: re(p.path), thumbPath: re(p.thumbPath) })),
      posterPath: day.posterPath ? re(day.posterPath) || null : null,
      voice: day.voice ? { ...day.voice, path: re(day.voice.path) } : null,
      song: day.song.kind === 'file' ? { ...day.song, path: re(day.song.path) } : day.song,
    },
  };
}

/** День для гостя: без ключа дневника, id дня, города и поправок владельца. */
export function publicDay(day: DayRecord): DayRecord {
  return {
    ...day,
    id: '', diaryId: '', shareId: null, place: null, moodOverride: null, error: null,
    photos: day.photos.map((p) => ({ ...p, path: '', thumbPath: '' })),
    song: day.song.kind === 'file' ? { kind: 'file', path: '', title: day.song.title, artist: day.song.artist } : day.song,
    posterPath: null,
    voice: day.voice ? { path: '', url: day.voice.url, preset: day.voice.preset } : null,
  };
}
