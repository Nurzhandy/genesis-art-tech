// Как открывается день (план 20.11, C3): обычная обложка или письмо в конверте.
import type { DayAnalysis, DayRecord } from './types';

export type Ritual = 'cover' | 'envelope';

/** Конверт — для дней, которые «приходят»: из «В этот день» и капсулы, которые уже открылись. */
export function ritualFor(day: Pick<DayRecord, 'sealedUntil' | 'sealed'>, from: string | null | undefined): Ritual {
  if (from === 'onthisday' || from === 'capsule') return 'envelope';
  return day.sealedUntil && !day.sealed ? 'envelope' : 'cover';
}

/** Начало письма: целые предложения, не длиннее `max` символов. */
export function letterExcerpt(text: string, max = 180): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const sentences = t.match(/[^.!?…]+[.!?…]+/g) ?? [];
  let out = '';
  for (const s of sentences) {
    if ((out + s).trim().length > max) break;
    out += s;
  }
  out = out.trim();
  if (out) return out;
  const cut = t.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : max).trim() + '…';
}

export const SEASON_GLYPH: Record<DayAnalysis['season'], string> = { winter: '❄', spring: '✿', summer: '☀', autumn: '❦', unknown: '✉' };
