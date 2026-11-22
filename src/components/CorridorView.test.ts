import { describe, expect, it } from 'vitest';
import { nearestDay } from './CorridorView';

describe('nearestDay', () => {
  it('в начале коридора — первый день, в конце — последний', () => {
    expect(nearestDay(0, 7)).toBe(0);
    expect(nearestDay(100000, 7)).toBe(6);
  });
  it('по мере прокрутки дни сменяются по одному', () => {
    const seen = new Set<number>();
    for (let cam = 0; cam <= 700 + 6 * 520 + 200; cam += 40) seen.add(nearestDay(cam, 7));
    expect([...seen]).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
