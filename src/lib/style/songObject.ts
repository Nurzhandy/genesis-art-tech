// Песня как предмет на странице (ресерч S2, docs/research/scrapbook-flipbook.md).
// Носитель выбирается по году песни, вращение — по её темпу. По клику предмет включает песню.
import type { SongObjectKind, StyleInput, StyleReason } from '@/lib/types';
import { round, signals } from './signals';

export const SONG_OBJECT_NAMES: Record<SongObjectKind, string> = {
  vinyl: 'пластинка', cassette: 'кассета', cd: 'CD-диск', stream: 'стикер плеера',
};

/** Эпоха носителя: на чём эту песню слушали, когда она вышла. */
export function songObjectKind(year: number | null): SongObjectKind {
  if (year === null) return 'stream';
  if (year < 1985) return 'vinyl';
  if (year < 2000) return 'cassette';
  if (year < 2012) return 'cd';
  return 'stream';
}

export function buildSongObject(input: StyleInput): { songObject: { kind: SongObjectKind; year: number | null; revPerSec: number }; reason: StyleReason } {
  const s = signals(input);
  const kind = songObjectKind(s.year);
  // Пластинка и кассета делают оборот за такт (4 доли), диск крутится вдвое быстрее.
  const revPerSec = round((s.bpm / 240) * (kind === 'cd' ? 2 : 1), 3);
  const when = s.year ? `Песня ${s.year} года` : 'Год песни неизвестен';
  const how = kind === 'stream'
    ? `полоски эквалайзера пульсируют в долю (${s.bpm} BPM)`
    : `${kind === 'cassette' ? 'катушки делают' : 'делает'} ${kind === 'cd' ? 'два оборота' : 'оборот'} за такт (${s.bpm} BPM)`;
  return {
    songObject: { kind, year: s.year, revPerSec },
    reason: { param: 'songObject', because: `${when} → на странице ${SONG_OBJECT_NAMES[kind]}: ${how}. Нажмите на неё — заиграет песня` },
  };
}
