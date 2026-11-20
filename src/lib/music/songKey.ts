// Ключ песни для «Все дни этой песни» (план 20.11, A6): одна и та же песня по ссылкам разных сервисов
// и своим файлом даёт один ключ, если известны исполнитель и название.
import type { SongRef } from '@/lib/types';
import { parseSongUrl } from './parseSongUrl';

const norm = (s: string) => s.toLocaleLowerCase('ru').replace(/ё/g, 'е')
  .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')          // «(Remastered 2008)», «[Live]»
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Все ключи песни: «исполнитель — название» и «сервис:id трека». Дни одной песни находят друг друга,
 * даже если у одного сервис отдал название, а у другого осталась только ссылка.
 */
export function songKeys(song: SongRef): string[] {
  const keys: string[] = [];
  const title = song.title ? norm(song.title) : '';
  if (title) keys.push(song.artist && norm(song.artist) ? `${norm(song.artist)} — ${title}` : title);
  if (song.kind === 'link') {
    const p = parseSongUrl(song.url);
    if (p?.id) keys.push(`${p.provider}:${p.id}`);
  }
  return keys;
}

export const songKey = (song: SongRef): string | null => songKeys(song)[0] ?? null;

/** Подходит ли день под фильтр «все дни этой песни». */
export const sameSong = (song: SongRef, keys: string[]) => songKeys(song).some((k) => keys.includes(k));
