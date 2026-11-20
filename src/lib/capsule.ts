// Капсула времени (план 20.11, A5): до даты `sealedUntil` день отдаёт только дату и название.
import type { DayRecord } from './types';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Сегодня по Астане — дневник живёт в этом часовом поясе. */
export function serverToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function isSealed(day: Pick<DayRecord, 'sealedUntil'>, today: string): boolean {
  return !!day.sealedUntil && today < day.sealedUntil;
}

/** Запечатать можно только в будущее и не дальше, чем на 10 лет. */
export function sealDateError(sealedUntil: string, today: string): string | null {
  if (!ISO.test(sealedUntil) || Number.isNaN(Date.parse(sealedUntil))) return 'Неверная дата капсулы';
  if (sealedUntil <= today) return 'Капсулу можно запечатать только до будущей даты';
  const max = `${Number(today.slice(0, 4)) + 10}${today.slice(4)}`;
  if (sealedUntil > max) return 'Капсула — не дольше чем на 10 лет';
  return null;
}

/** Что видно у запечатанного дня: дата, название, дата открытия. Текст, фото, песня и стиль скрыты. */
export function sealedView(day: DayRecord): DayRecord {
  return {
    id: day.id, diaryId: day.diaryId, date: day.date, title: day.title, slug: day.slug,
    text: '', photos: [], song: { kind: 'link', url: '', provider: 'other' },
    music: null, analysis: null, style: null, voice: null, posterPath: null,
    status: day.status, error: day.status === 'error' ? day.error : null, createdAt: day.createdAt,
    sealedUntil: day.sealedUntil, sealed: true, dayNumber: day.dayNumber,
  };
}

/** Для ответа API: запечатанный день — без содержимого, остальные как есть. */
export const revealable = (day: DayRecord, today = serverToday()): DayRecord => (isSealed(day, today) ? sealedView(day) : day);
