import { describe, expect, it } from 'vitest';
import { fitSongLine } from './layout';

const measure = (t: string) => Array.from(t).length * 10; // 10px на символ

describe('fitSongLine', () => {
  it('оставляет короткое название как есть', () => {
    expect(fitSongLine(measure, 'Sinatra — Autumn', 96, 1000)).toBe('♪ Sinatra — Autumn · 96 BPM');
  });

  it('обрезает длинное название многоточием и сохраняет BPM', () => {
    const line = fitSongLine(measure, 'Frank Sinatra — Autumn Leaves (Remastered 1999)', 96.4, 300);
    expect(measure(line)).toBeLessThanOrEqual(300);
    expect(line.endsWith('… · 96 BPM')).toBe(true);
    expect(line.startsWith('♪ Frank')).toBe(true);
  });

  it('без песни и при нехватке места показывает только BPM', () => {
    expect(fitSongLine(measure, undefined, 120, 1000)).toBe('♪ · 120 BPM');
    expect(fitSongLine(measure, 'Очень длинное', 120, 100)).toBe('♪ · 120 BPM');
  });
});
