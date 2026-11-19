import { describe, expect, it } from 'vitest';
import { mulberry32, noise2 } from './rng';
import { photoTime } from './timeline';

const motion = (o = {}) => ({ bpm: 120, beatsPerPhoto: 4 as const, jitter: 0.3, easing: 'soft' as const, ...o });
// 120 BPM, 4 доли → кадр 2 с, доля 0.5 с

describe('photoTime', () => {
  it('в начале — первый кадр, показан сразу (предыдущего ещё не было)', () => {
    expect(photoTime(0, motion(), 3)).toMatchObject({ index: 0, prevIndex: 2, local: 0, transition: 1, beat: 0 });
    expect(photoTime(0.1, motion(), 3).transition).toBe(1);
  });
  it('середина второго кадра', () => {
    const p = photoTime(3, motion(), 3);
    expect(p.index).toBe(1);
    expect(p.prevIndex).toBe(0);
    expect(p.local).toBeCloseTo(0.5);
    expect(p.transition).toBe(1);
    expect(p.beat).toBe(6);
  });
  it('после последнего кадра идёт по кругу', () => {
    expect(photoTime(6.2, motion(), 3).index).toBe(0);
    expect(photoTime(6.2, motion(), 3).cycle).toBe(1);
  });
  it('мягкий переход длится одну долю и плавно растёт', () => {
    const p = photoTime(2.25, motion(), 3);
    expect(p.transition).toBeGreaterThan(0.3);
    expect(p.transition).toBeLessThan(0.7);
  });
  it('резкий переход почти мгновенный', () => {
    expect(photoTime(2.1, motion({ easing: 'sharp' }), 3).transition).toBe(1);
  });
  it('фаза доли от 0 до 1', () => {
    expect(photoTime(0.25, motion(), 3).beatPhase).toBeCloseTo(0.5);
  });
  it('одно фото — всегда индекс 0', () => {
    expect(photoTime(10, motion(), 1).index).toBe(0);
  });
});

describe('rng', () => {
  it('одинаковый seed — одинаковая последовательность', () => {
    const a = mulberry32(42), b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('значения в [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('шум гладкий и детерминированный', () => {
    expect(noise2(1.5, 2.5, 3)).toBe(noise2(1.5, 2.5, 3));
    expect(Math.abs(noise2(1.5, 2.5, 3) - noise2(1.51, 2.5, 3))).toBeLessThan(0.05);
  });
});
