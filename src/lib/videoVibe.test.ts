import { describe, expect, it } from 'vitest';
import type { PhotoFeatures } from './types';
import { photoVibe, VIBES } from './videoVibe';

const p = (brightness: number, warmth: number, saturation: number): PhotoFeatures => ({ index: 0, width: 1, height: 1, palette: ['#888888'], brightness, warmth, saturation });

describe('настроение фото для видео', () => {
  it('светлые тёплые — лето, тёмные холодные — ночь, тусклые — тишина', () => {
    expect(photoVibe([p(0.7, 0.5, 0.4)])).toBe('summer');
    expect(photoVibe([p(0.2, -0.4, 0.3)])).toBe('night');
    expect(photoVibe([p(0.2, 0.4, 0.3)])).toBe('golden');
    expect(photoVibe([p(0.5, 0, 0.1)])).toBe('calm');
    expect(photoVibe([p(0.6, -0.3, 0.35)])).toBe('dreamy');
  });
  it('много ярких насыщенных кадров — праздник', () => {
    expect(photoVibe(Array.from({ length: 8 }, () => p(0.6, 0.3, 0.7)))).toBe('party');
  });
  it('у каждого настроения есть жанр и темп', () => {
    for (const v of Object.values(VIBES)) { expect(v.genre).toBeGreaterThan(0); expect(v.bpm).toBeGreaterThan(60); }
  });
});
