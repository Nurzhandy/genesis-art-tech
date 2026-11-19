import { describe, expect, it } from 'vitest';
import { noteAlpha, placeNotes } from './notes';
import { photoTime } from './timeline';

const W = 1080, H = 1920, margin = 0.08;
const zone = { x: 86.4, y: 412.8, w: 907.2, h: 1113.6 };
const motion = { bpm: 120, beatsPerPhoto: 4 as const, jitter: 0.3, easing: 'soft' as const };

describe('placeNotes', () => {
  it('каждая заметка целиком на полях слева или справа и по высоте в зоне фото', () => {
    for (const seed of [1, 42, 1018, 99999]) {
      for (const p of placeNotes(4, seed, W, H, margin, zone, 0)) {
        if (p.side === 'left') { expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(margin * W); }
        else { expect(p.x).toBeGreaterThan(W - margin * W); expect(p.x).toBeLessThan(W); }
        expect(p.y).toBeGreaterThanOrEqual(zone.y);
        expect(p.y).toBeLessThanOrEqual(zone.y + zone.h);
      }
    }
  });
  it('текст идёт вдоль поля с наклоном подписи ±2°', () => {
    for (const p of placeNotes(4, 7, W, H, margin, zone, 3)) {
      const deg = (p.angle * 180) / Math.PI;
      const base = p.side === 'left' ? -90 : 90;
      expect(Math.abs(deg - base - 3)).toBeLessThanOrEqual(2.0001);
    }
  });
  it('места детерминированы seed и не налезают друг на друга на одном поле', () => {
    expect(placeNotes(4, 5, W, H, margin, zone, 0)).toEqual(placeNotes(4, 5, W, H, margin, zone, 0));
    const ps = placeNotes(4, 5, W, H, margin, zone, 0);
    for (const side of ['left', 'right'] as const) {
      const ys = ps.filter((p) => p.side === side).map((p) => p.y).sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThan(zone.h / 4);
    }
  });
});

describe('noteAlpha', () => {
  it('на постере видны все', () => {
    expect(noteAlpha(3, photoTime(0, motion, 3), motion, 3, true)).toBe(1);
  });
  it('первая заметка проявляется за первую долю', () => {
    expect(noteAlpha(0, photoTime(0, motion, 3), motion, 3, false)).toBe(0);
    expect(noteAlpha(0, photoTime(0.25, motion, 3), motion, 3, false)).toBeCloseTo(0.5);
    expect(noteAlpha(0, photoTime(0.6, motion, 3), motion, 3, false)).toBe(1);
  });
  it('по одной новой заметке на каждую смену кадра', () => {
    const pt = photoTime(4.6, motion, 3);       // третий кадр (слот 2), прошла 1 доля
    expect(noteAlpha(1, pt, motion, 3, false)).toBe(1);
    expect(noteAlpha(2, pt, motion, 3, false)).toBe(1);
    expect(noteAlpha(3, pt, motion, 3, false)).toBe(0);
  });
  it('после полного круга видны все', () => {
    expect(noteAlpha(3, photoTime(6.6, motion, 3), motion, 3, false)).toBe(1);
  });
});
