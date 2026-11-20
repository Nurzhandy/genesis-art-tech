import { describe, expect, it } from 'vitest';
import { letterExcerpt, ritualFor } from './ritual';

describe('конверт (C3)', () => {
  it('из «В этот день» и для открывшейся капсулы — конверт', () => {
    expect(ritualFor({ sealedUntil: null }, 'onthisday')).toBe('envelope');
    expect(ritualFor({ sealedUntil: '2026-11-01', sealed: false }, null)).toBe('envelope');
    expect(ritualFor({ sealedUntil: null }, null)).toBe('cover');
    expect(ritualFor({ sealedUntil: '2027-11-01', sealed: true }, null)).toBe('cover');
  });
  it('в письме — целые предложения', () => {
    const t = 'Гуляли по парку. Было холодно, руки мёрзли. ' + 'Очень длинное предложение '.repeat(10) + '.';
    expect(letterExcerpt(t, 60)).toBe('Гуляли по парку. Было холодно, руки мёрзли.');
    expect(letterExcerpt('Коротко.')).toBe('Коротко.');
  });
  it('одно длинное предложение обрезается по слову с многоточием', () => {
    const r = letterExcerpt('слово '.repeat(60), 50);
    expect(r.endsWith('…')).toBe(true);
    expect(r.length).toBeLessThanOrEqual(51);
  });
});
