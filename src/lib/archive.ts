// Логика архива (A8, A10 / R12): группировка по месяцам, календарь, «В этот день».
import type { DayRecord } from './types';

export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export const monthKey = (date: string) => date.slice(0, 7);
export const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

/** Дни по месяцам, новые сверху (порядок дней сохраняется). */
export function groupByMonth(days: DayRecord[]): [string, DayRecord[]][] {
  const m = new Map<string, DayRecord[]>();
  for (const d of days) m.set(monthKey(d.date), [...(m.get(monthKey(d.date)) ?? []), d]);
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

export interface CalendarCell { day: number; date: string; entries: DayRecord[] }

/** Сетка месяца с понедельника: null — пустые клетки до первого числа. */
export function monthGrid(key: string, days: DayRecord[]): (CalendarCell | null)[] {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = вс
  const lead = (first + 6) % 7;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (CalendarCell | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= count; d++) {
    const date = `${key}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, date, entries: days.filter((x) => x.date === date) });
  }
  return cells;
}

/** Цвет дня для календаря: главный акцент его палитры. */
export const dayColor = (d: DayRecord) => d.style?.palette.accents[0] ?? d.style?.palette.bg ?? '#b9ad9c';

/** «В этот день»: то же число и месяц в прошлые годы. */
export function onThisDay(days: DayRecord[], today: string): DayRecord[] {
  return days.filter((d) => d.date.slice(5) === today.slice(5) && d.date.slice(0, 4) < today.slice(0, 4));
}

export const yearsAgo = (date: string, today: string) => Number(today.slice(0, 4)) - Number(date.slice(0, 4));

export function yearsWord(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} год`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} года`;
  return `${n} лет`;
}

export const humanDate = (date: string) => `${Number(date.slice(8, 10))} ${MONTHS_GEN[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
