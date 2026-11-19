import { describe, expect, it } from 'vitest';
import { volumeAt, VOICE_DUCK } from './fade';

describe('volumeAt', () => {
  it('в начале — исходная громкость, в конце — целевая', () => {
    expect(volumeAt(0, 1, 0, 2000)).toBe(0);
    expect(volumeAt(0, 1, 2000, 2000)).toBe(1);
    expect(volumeAt(0, 1, 5000, 2000)).toBe(1);
  });
  it('нарастает плавно и монотонно', () => {
    const vs = [0, 250, 500, 1000, 1500, 1999].map((t) => volumeAt(0, 1, t, 2000));
    for (let i = 1; i < vs.length; i++) expect(vs[i]).toBeGreaterThan(vs[i - 1]);
    expect(volumeAt(0, 1, 1000, 2000)).toBeCloseTo(0.5, 1);
  });
  it('приглушение под озвучку до 25%', () => {
    expect(VOICE_DUCK).toBe(0.25);
    expect(volumeAt(1, VOICE_DUCK, 600, 600)).toBe(0.25);
  });
  it('громкость всегда в 0..1', () => {
    expect(volumeAt(-1, 2, 1000, 2000)).toBeGreaterThanOrEqual(0);
    expect(volumeAt(-1, 2, 2000, 2000)).toBeLessThanOrEqual(1);
  });
});
