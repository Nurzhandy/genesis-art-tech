import { describe, expect, it } from 'vitest';
import type { DayRecord } from './types';
import { atlasPoints, blobPath, chronological } from './atlas';

const day = (id: string, date: string, valence: number, arousal: number, o: Partial<DayRecord> = {}): DayRecord => ({
  id, diaryId: 'd', date, title: id, slug: id, text: '', photos: [], song: { kind: 'file', path: 'x' }, music: null,
  analysis: { mood: { valence, arousal, tension: 0, nostalgia: 0 } } as DayRecord['analysis'],
  style: { palette: { bg: '#fff', paper: '#fff', ink: '#000', accents: ['#c8892b', '#3a6ea5'] }, motion: { bpm: 120 } } as DayRecord['style'],
  voice: null, posterPath: null, status: 'ready', error: null, createdAt: date, ...o,
});

describe('атлас дней', () => {
  it('тёплый живой день — справа сверху, холодный тихий — слева снизу', () => {
    const [warm, cold] = atlasPoints([day('a', '2026-10-01', 0.8, 0.9), day('b', '2026-10-02', -0.7, 0.1)]);
    expect(warm.x).toBeGreaterThan(0.8);
    expect(warm.y).toBeGreaterThan(0.8);
    expect(cold.x).toBeLessThan(0.2);
    expect(cold.y).toBeLessThan(0.2);
  });

  it('поправка «Не совсем так?» двигает пятно на карте', () => {
    const [base] = atlasPoints([day('a', '2026-10-01', 0, 0.5)]);
    const [tuned] = atlasPoints([day('a', '2026-10-01', 0, 0.5, { moodOverride: { warmth: 0.4, energy: -0.4 } })]);
    expect(tuned.x).toBeGreaterThan(base.x);
    expect(tuned.y).toBeLessThan(base.y);
  });

  it('дыхание пятна — четыре доли песни дня', () => {
    expect(atlasPoints([day('a', '2026-10-01', 0, 0)])[0].beatSec).toBe(2);
  });

  it('дни без анализа (запечатанные капсулы) на карту не попадают', () => {
    expect(atlasPoints([day('a', '2026-10-01', 0, 0, { analysis: null })])).toHaveLength(0);
  });

  it('форма пятна у дня всегда одна и та же, у разных дней разная', () => {
    expect(blobPath('a', 40)).toBe(blobPath('a', 40));
    expect(blobPath('a', 40)).not.toBe(blobPath('b', 40));
    expect(blobPath('a', 40)).toMatch(/^M.+Z$/);
  });

  it('нить идёт от первого дня к последнему', () => {
    const pts = atlasPoints([day('c', '2026-11-03', 0, 0), day('a', '2026-10-01', 0, 0), day('b', '2026-10-20', 0, 0)]);
    expect(chronological(pts).map((p) => p.day.id)).toEqual(['a', 'b', 'c']);
  });
});
