// «Год в цветах» (план 20.11, C4): 12 месяцев × 31 день, цвет клетки — главный цвет дня.
// Без «анализа настроения»: только цвета, песни и тепло фотографий.
import { dayColor } from './archive';
import { songKeys } from './music/songKey';
import type { DayRecord } from './types';

export interface YearCell { date: string; inMonth: boolean; color: string | null; dayId: string | null; title: string | null; count: number }

const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();   // m: 1..12

export const yearDays = (days: DayRecord[], year: number) =>
  days.filter((d) => d.status === 'ready' && !d.sealed && d.date.startsWith(`${year}-`));

export function yearGrid(days: DayRecord[], year: number): YearCell[][] {
  const byDate = new Map<string, DayRecord[]>();
  for (const d of yearDays(days, year)) byDate.set(d.date, [...(byDate.get(d.date) ?? []), d]);
  return Array.from({ length: 12 }, (_, mi) => {
    const m = mi + 1, last = daysInMonth(year, m);
    return Array.from({ length: 31 }, (_, di) => {
      const date = `${year}-${pad(m)}-${pad(di + 1)}`;
      const list = byDate.get(date) ?? [];
      const first = list[0];
      return { date, inMonth: di + 1 <= last, color: first ? dayColor(first) : null, dayId: first?.id ?? null, title: first?.title ?? null, count: list.length };
    });
  });
}

export const songName = (d: DayRecord) => [d.song.artist, d.song.title].filter(Boolean).join(' — ');

/** Песня года: чаще всего звучала (минимум в двух днях). При равенстве — та, что появилась раньше. */
export function songOfYear(days: DayRecord[]): { label: string; count: number } | null {
  const groups: { keys: string[]; label: string; count: number; first: string }[] = [];
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const keys = songKeys(d.song);
    if (!keys.length) continue;
    const g = groups.find((x) => x.keys.some((k) => keys.includes(k)));
    if (g) { g.count++; g.keys.push(...keys); if (!g.label) g.label = songName(d); }
    else groups.push({ keys, label: songName(d), count: 1, first: d.date });
  }
  const best = groups.filter((g) => g.count >= 2 && g.label).sort((a, b) => b.count - a.count || a.first.localeCompare(b.first))[0];
  return best ? { label: best.label, count: best.count } : null;
}

/** Тепло дня — средняя «теплота» его фотографий (−1 холодно … 1 тепло). */
export const dayWarmth = (d: DayRecord) => (d.photos.length ? d.photos.reduce((a, p) => a + p.features.warmth, 0) / d.photos.length : 0);

/** Понедельник недели, в которую попал день. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Самая тёплая неделя по фото: нужна хотя бы одна неделя с двумя днями, иначе сравнивать нечего. */
export function warmestWeek(days: DayRecord[]): { start: string; end: string; days: number } | null {
  const weeks = new Map<string, DayRecord[]>();
  for (const d of days) weeks.set(weekStart(d.date), [...(weeks.get(weekStart(d.date)) ?? []), d]);
  if (weeks.size < 2) return null;
  let best: { start: string; score: number; n: number } | null = null;
  for (const [start, list] of weeks) {
    const score = list.reduce((a, d) => a + dayWarmth(d), 0) / list.length;
    if (!best || score > best.score) best = { start, score, n: list.length };
  }
  const end = new Date(`${best!.start}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: best!.start, end: end.toISOString().slice(0, 10), days: best!.n };
}

export const yearsOf = (days: DayRecord[]) => [...new Set(days.filter((d) => !d.sealed).map((d) => Number(d.date.slice(0, 4))))].sort((a, b) => b - a);
