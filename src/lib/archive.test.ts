import { describe, expect, it } from 'vitest';
import type { DayRecord } from './types';
import { dayColor, groupByMonth, humanDate, monthGrid, monthLabel, onThisDay, yearsWord } from './archive';

const day = (date: string, accent = '#c8892b'): DayRecord => ({
  id: date, diaryId: 'd', date, title: 't', slug: 's', text: '', photos: [], song: { kind: 'file', path: 'x/song.mp3' }, music: null, analysis: null,
  style: { palette: { bg: '#ffffff', paper: '#fff', ink: '#000', accents: [accent] } } as DayRecord['style'],
  voice: null, posterPath: null, status: 'ready', error: null, createdAt: '',
});

describe('архив (R12)', () => {
  it('месяцы идут от новых к старым', () => {
    const g = groupByMonth([day('2026-10-01'), day('2026-11-03'), day('2026-10-20')]);
    expect(g.map(([k]) => k)).toEqual(['2026-11', '2026-10']);
    expect(monthLabel('2026-11')).toBe('Ноябрь 2026');
  });

  it('календарь начинается с понедельника: ноябрь 2026 начинается в воскресенье', () => {
    const g = monthGrid('2026-11', [day('2026-11-03')]);
    expect(g.slice(0, 6).every((c) => c === null)).toBe(true);
    expect(g[6]).toMatchObject({ day: 1, date: '2026-11-01' });
    expect(g.filter(Boolean)).toHaveLength(30);
    expect(g.find((c) => c?.date === '2026-11-03')?.entries).toHaveLength(1);
  });

  it('клетка дня окрашена акцентом его палитры', () => {
    expect(dayColor(day('2026-11-03', '#123456'))).toBe('#123456');
  });

  it('«В этот день» — тот же день и месяц, только прошлые годы', () => {
    const list = [day('2025-11-19'), day('2024-11-19'), day('2026-11-19'), day('2025-11-18')];
    expect(onThisDay(list, '2026-11-19').map((d) => d.date)).toEqual(['2025-11-19', '2024-11-19']);
  });

  it('по-русски: год, года, лет', () => {
    expect([1, 2, 5, 11, 21, 22].map(yearsWord)).toEqual(['1 год', '2 года', '5 лет', '11 лет', '21 год', '22 года']);
    expect(humanDate('2026-11-03')).toBe('3 ноября 2026');
  });
});
