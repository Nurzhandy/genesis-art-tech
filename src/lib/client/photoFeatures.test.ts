import { describe, expect, it } from 'vitest';
import { computeFeatures } from './photoFeatures';

const solid = (r: number, g: number, b: number, n = 100) => {
  const a = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) a.set([r, g, b, 255], i * 4);
  return a;
};
const halves = (c1: number[], c2: number[], n = 100) => {
  const a = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) a.set([...(i < n * 0.7 ? c1 : c2), 255], i * 4);
  return a;
};

describe('computeFeatures', () => {
  it('оранжевое фото — тёплое', () => {
    expect(computeFeatures(solid(255, 140, 0), 10, 10, 0).warmth).toBeGreaterThan(0.5);
  });
  it('синее фото — холодное', () => {
    expect(computeFeatures(solid(30, 60, 200), 10, 10, 0).warmth).toBeLessThan(-0.5);
  });
  it('чёрное фото — тёмное', () => {
    expect(computeFeatures(solid(0, 0, 0), 10, 10, 0).brightness).toBeLessThan(0.05);
  });
  it('серое фото — без насыщенности и нейтральное', () => {
    const f = computeFeatures(solid(128, 128, 128), 10, 10, 0);
    expect(f.saturation).toBeLessThan(0.05);
    expect(Math.abs(f.warmth)).toBeLessThan(0.05);
  });
  it('главный цвет палитры — цвет фото', () => {
    expect(computeFeatures(solid(255, 140, 0), 10, 10, 0).palette[0]).toBe('#ff8c00');
  });
  it('палитра упорядочена по доле: 70% оранжевого раньше 30% синего', () => {
    const f = computeFeatures(halves([255, 140, 0], [30, 60, 200]), 10, 10, 2);
    expect(f.palette.slice(0, 2)).toEqual(['#ff8c00', '#1e3cc8']);
    expect(f.index).toBe(2);
    expect(f.width).toBe(10);
  });
});
