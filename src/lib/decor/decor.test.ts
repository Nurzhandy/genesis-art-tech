import { describe, expect, it } from 'vitest';
import { DecorSchema, normalizeDecor, resolveColor, STICKER_SHAPES } from './decor';

const palette = { bg: '#f0e6d8', paper: '#fbf6ee', ink: '#2b241c', accents: ['#c8892b', '#7a3b2e'] };
const sticker = (i: number) => ({ id: `s${i}`, kind: 'sticker', shape: 'star', x: 100, y: 100, scale: 1, rot: 0, color: 'a0' });

describe('украшения страницы', () => {
  it('у старого дня без украшений — пустой слой', () => {
    expect(normalizeDecor(undefined)).toEqual({ v: 1, source: 'auto', items: [] });
    expect(normalizeDecor({ junk: true })).toEqual({ v: 1, source: 'auto', items: [] });
  });
  it('цвета только из палитры дня и перекрашиваются вместе с ней', () => {
    expect(resolveColor('ink', palette)).toBe('#2b241c');
    expect(resolveColor('paper', palette)).toBe('#fbf6ee');
    expect(resolveColor('a1', palette)).toBe('#7a3b2e');
    expect(resolveColor('a2', palette)).toBe('#c8892b');   // третьего акцента нет — берём первый
    expect(DecorSchema.safeParse({ v: 1, source: 'user', items: [{ ...sticker(0), color: '#ff0000' }] }).success).toBe(false);
  });
  it('лимиты: до 40 элементов, штрих до 400 точек, текст до 80 символов', () => {
    expect(DecorSchema.safeParse({ v: 1, source: 'user', items: Array.from({ length: 40 }, (_, i) => sticker(i)) }).success).toBe(true);
    expect(DecorSchema.safeParse({ v: 1, source: 'user', items: Array.from({ length: 41 }, (_, i) => sticker(i)) }).success).toBe(false);
    const stroke = (n: number) => ({ id: 'k', kind: 'stroke', points: Array.from({ length: n * 2 }, () => 10), width: 5, color: 'ink' });
    expect(DecorSchema.safeParse({ v: 1, source: 'user', items: [stroke(400)] }).success).toBe(true);
    expect(DecorSchema.safeParse({ v: 1, source: 'user', items: [stroke(401)] }).success).toBe(false);
    const text = (t: string) => ({ id: 't', kind: 'text', text: t, x: 1, y: 1, size: 60, rot: 0, color: 'ink' });
    expect(DecorSchema.safeParse({ v: 1, source: 'user', items: [text('я'.repeat(80))] }).success).toBe(true);
    expect(DecorSchema.safeParse({ v: 1, source: 'user', items: [text('я'.repeat(81))] }).success).toBe(false);
  });
  it('сияющая кисть: симметрия 1, 2, 4 или 6 лучей', () => {
    const stroke = (sym: number) => ({ id: 'g', kind: 'stroke', points: [10, 10, 20, 20], width: 5, color: 'a0', glow: true, sym });
    expect(DecorSchema.safeParse({ v: 1, source: 'user', items: [stroke(4)] }).success).toBe(true);
    expect(DecorSchema.safeParse({ v: 1, source: 'user', items: [stroke(3)] }).success).toBe(false);
  });
  it('координаты в пределах холста 1080×1920, неизвестная форма отклоняется', () => {
    expect(DecorSchema.safeParse({ v: 1, source: 'user', items: [{ ...sticker(0), x: 5000 }] }).success).toBe(false);
    expect(DecorSchema.safeParse({ v: 1, source: 'user', items: [{ ...sticker(0), shape: 'unicorn' }] }).success).toBe(false);
    expect(STICKER_SHAPES).toHaveLength(16);
  });
});
