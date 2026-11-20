import { describe, expect, it } from 'vitest';
import type { DayRecord } from './types';
import { findThemes, MAX_PHOTOS, montagePlan, TITLE_SEC } from './themes';

const day = (id: string, date: string, a: Partial<NonNullable<DayRecord['analysis']>>, o: Partial<DayRecord> = {}): DayRecord => ({
  id, diaryId: 'd', date, title: id, slug: id, text: '', status: 'ready', error: null, createdAt: date,
  photos: [{ path: 'p', thumbPath: 't', features: {} as never }, { path: 'p2', thumbPath: 't2', features: {} as never }],
  song: { kind: 'link', url: `https://www.deezer.com/track/${id}`, provider: 'deezer', artist: 'A', title: id },
  music: null, analysis: { mood: { valence: 0, arousal: 0.5, tension: 0, nostalgia: 0 }, season: 'unknown', timeOfDay: 'unknown', setting: 'mixed', people: 'unknown', ...a } as DayRecord['analysis'],
  style: { palette: { bg: '#fff', paper: '#fff', ink: '#000', accents: ['#c8892b'] }, motion: { bpm: 120 } } as DayRecord['style'],
  voice: null, posterPath: null, ...o,
});

describe('фильмы по темам', () => {
  const days = [
    day('a', '2026-10-01', { season: 'autumn', setting: 'water' }),
    day('b', '2026-10-15', { season: 'autumn', people: 'group' }),
    day('c', '2026-11-02', { season: 'autumn', setting: 'water', people: 'group' }),
    day('d', '2026-07-02', { season: 'summer' }),
  ];

  it('находит общие темы, где хотя бы два дня, крупные — первыми', () => {
    const t = findThemes(days);
    expect(t[0]).toMatchObject({ id: 'autumn', title: 'Осень' });
    expect(t[0].days.map((d) => d.id)).toEqual(['a', 'b', 'c']);
    expect(t.map((x) => x.id)).toEqual(expect.arrayContaining(['water', 'friends', 'all']));
    expect(t.map((x) => x.id)).not.toContain('summer');   // один летний день — не тема
    expect(t.at(-1)?.id).toBe('all');
  });

  it('дни под одну песню становятся отдельной темой', () => {
    const song = { kind: 'link' as const, url: 'https://www.deezer.com/track/3231839', provider: 'deezer' as const, artist: 'Frank Sinatra', title: 'Autumn Leaves' };
    const t = findThemes([day('a', '2026-10-01', {}, { song }), day('b', '2026-11-01', {}, { song })]);
    expect(t.find((x) => x.id.startsWith('song:'))?.why).toContain('Frank Sinatra — Autumn Leaves');
  });

  it('несобранные, запечатанные и дни без фото не попадают в фильм', () => {
    const t = findThemes([day('a', '2026-10-01', { season: 'autumn' }), day('b', '2026-10-02', { season: 'autumn' }, { photos: [] }), day('c', '2026-10-03', { season: 'autumn' }, { status: 'generating' })]);
    expect(t.find((x) => x.id === 'autumn')).toBeUndefined();
  });

  it('монтаж: титр, кадр на каждое фото в ритме песни, финал', () => {
    const { shots, duration } = montagePlan({ days: days.slice(0, 2) });
    expect(shots).toHaveLength(4);
    expect(shots[0].start).toBe(TITLE_SEC);
    expect(shots[0].end - shots[0].start).toBeCloseTo(2, 6);   // 4 доли при 120 BPM
    expect(duration).toBeGreaterThan(shots.at(-1)!.end);
  });

  it('много фото — берём равномерно, фильм не длиннее ~60 с', () => {
    const many = Array.from({ length: 20 }, (_, i) => day(`x${i}`, `2026-10-${String(i + 1).padStart(2, '0')}`, {}));
    const { shots, duration } = montagePlan({ days: many });
    expect(shots).toHaveLength(MAX_PHOTOS);
    expect(new Set(shots.map((s) => s.day)).size).toBeGreaterThan(10);
    expect(duration).toBeLessThan(65);
  });
});
