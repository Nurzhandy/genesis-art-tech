import { describe, expect, it } from 'vitest';
import type { DayRecord } from './types';
import { songOfYear, warmestWeek, weekStart, yearGrid, yearsOf } from './year';

const day = (date: string, o: Partial<DayRecord> = {}, warmth = 0): DayRecord => ({
  id: date, diaryId: 'd', date, title: 'День', slug: 's', text: '',
  photos: [{ path: '', thumbPath: '', features: { index: 0, width: 1, height: 1, palette: ['#000000'], brightness: 0.5, warmth, saturation: 0.5 } }],
  song: { kind: 'link', url: 'https://example.com', provider: 'other' }, music: null, analysis: null,
  style: { palette: { bg: '#ffffff', paper: '#fff', ink: '#000', accents: ['#c8892b'] } } as DayRecord['style'],
  voice: null, posterPath: null, status: 'ready', error: null, createdAt: '', ...o,
});
const sinatra = { kind: 'link' as const, url: 'https://www.deezer.com/track/1', provider: 'deezer' as const, artist: 'Frank Sinatra', title: 'Autumn Leaves' };

describe('год в цветах (C4)', () => {
  it('12 месяцев по 31 клетке, лишние дни месяца помечены', () => {
    const g = yearGrid([day('2026-02-14'), day('2025-02-14')], 2026);
    expect(g).toHaveLength(12);
    expect(g[1][13]).toMatchObject({ date: '2026-02-14', color: '#c8892b', dayId: '2026-02-14', inMonth: true });
    expect(g[1][28].inMonth).toBe(false);   // 29 февраля 2026 нет
    expect(g[0].filter((c) => c.color).length).toBe(0);
  });
  it('капсулы и несобранные дни в году не видны', () => {
    const g = yearGrid([day('2026-03-01', { sealed: true }), day('2026-03-02', { status: 'error' })], 2026);
    expect(g[2].some((c) => c.color)).toBe(false);
  });
  it('песня года — чаще всего, хотя бы в двух днях; ссылка без названия считается той же песней', () => {
    const days = [
      day('2026-01-01', { song: sinatra }),
      day('2026-02-01', { song: { kind: 'link', url: 'https://www.deezer.com/track/1', provider: 'deezer' } }),
      day('2026-03-01', { song: { kind: 'file', path: 'x', artist: 'Земфира', title: 'Искала' } }),
    ];
    expect(songOfYear(days)).toEqual({ label: 'Frank Sinatra — Autumn Leaves', count: 2 });
    expect(songOfYear(days.slice(2))).toBeNull();
  });
  it('неделя начинается с понедельника', () => {
    expect(weekStart('2026-11-20')).toBe('2026-11-16');
    expect(weekStart('2026-11-16')).toBe('2026-11-16');
    expect(weekStart('2026-11-22')).toBe('2026-11-16');
  });
  it('самая тёплая неделя по теплу фото', () => {
    const w = warmestWeek([day('2026-06-02', {}, 0.8), day('2026-06-03', {}, 0.6), day('2026-01-05', {}, -0.5)]);
    expect(w).toEqual({ start: '2026-06-01', end: '2026-06-07', days: 2 });
    expect(warmestWeek([day('2026-06-02')])).toBeNull();
  });
  it('годы дневника от новых к старым', () => {
    expect(yearsOf([day('2025-01-01'), day('2026-05-05'), day('2026-01-01')])).toEqual([2026, 2025]);
  });
});
