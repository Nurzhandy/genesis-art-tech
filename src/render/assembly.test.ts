import { describe, expect, it } from 'vitest';
import { assemblyAt, ASSEMBLY_ORDER } from './assembly';

const motion = (beatsPerPhoto: 2 | 4 | 8, easing: 'soft' | 'sharp' = 'soft') => ({ bpm: 120, beatsPerPhoto, jitter: 0.3, easing });
// 120 BPM → доля 0.5 с

describe('assemblyAt', () => {
  it('порядок: фото → марка и штампы → подпись → песня', () => {
    expect(ASSEMBLY_ORDER).toEqual(['photo', 'stamps', 'caption', 'song']);
  });
  it('в самом начале ничего не собрано, фото проявляется первым', () => {
    const a0 = assemblyAt(0, motion(4), true);
    expect(Object.values(a0).every((v) => v === 0)).toBe(true);
    const a1 = assemblyAt(0.3, motion(4), true);
    expect(a1.photo).toBeGreaterThan(0);
    expect(a1.song).toBe(0);
  });
  it('каждый следующий элемент появляется позже предыдущего', () => {
    const t = 1.2;
    const a = assemblyAt(t, motion(8), true);
    expect(a.photo).toBeGreaterThanOrEqual(a.stamps);
    expect(a.stamps).toBeGreaterThanOrEqual(a.caption);
    expect(a.caption).toBeGreaterThanOrEqual(a.song);
  });
  it('сборка длится столько долей, сколько держится кадр', () => {
    expect(Object.values(assemblyAt(4 * 0.5 + 0.51, motion(4), true)).every((v) => v === 1)).toBe(true);
    expect(assemblyAt(4 * 0.5 + 0.51, motion(8), true).song).toBeLessThan(1);
    expect(Object.values(assemblyAt(8 * 0.5 + 0.51, motion(8), true)).every((v) => v === 1)).toBe(true);
  });
  it('в напряжённый день элементы появляются рывком, без плавного проявления', () => {
    for (let t = 0; t < 3; t += 0.07) for (const v of Object.values(assemblyAt(t, motion(4, 'sharp'), true))) expect([0, 1]).toContain(v);
  });
  it('на постере и в статичном кадре всё собрано', () => {
    expect(Object.values(assemblyAt(0, motion(8), false)).every((v) => v === 1)).toBe(true);
  });
});
