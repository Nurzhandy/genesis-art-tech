import { describe, expect, it } from 'vitest';
import type { PhotoFeatures } from '@/lib/types';
import { validateTitle } from '@/lib/title/validateTitle';
import { fallbackAnalysis } from './fallback';

const photo = (o: Partial<PhotoFeatures> = {}): PhotoFeatures => ({
  index: 0, width: 100, height: 100, palette: ['#888888'], brightness: 0.5, warmth: 0, saturation: 0.2, ...o,
});

describe('fallbackAnalysis', () => {
  it('даже на «норм день» возвращает валидный анализ', () => {
    const a = fallbackAnalysis('норм день', '2026-11-19', [photo({ warmth: 0.1 })]);
    expect(a.source).toBe('fallback');
    expect(a.season).toBe('autumn');
    expect(validateTitle(a.title).ok).toBe(true);
    for (const v of [a.mood.arousal, a.mood.tension, a.mood.nostalgia]) {
      expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1);
    }
    expect(a.mood.valence).toBeGreaterThanOrEqual(-1);
    expect(a.mood.valence).toBeLessThanOrEqual(1);
    expect(a.caption.length).toBeLessThanOrEqual(60);
  });
  it('ловит ночь и дедлайн по словам', () => {
    const a = fallbackAnalysis('Сидел всю ночь в офисе, дедлайн, устал и нервничал', '2026-11-12', [photo({ warmth: -0.5, brightness: 0.2 })]);
    expect(a.timeOfDay).toBe('night');
    expect(a.setting).toBe('indoor');
    expect(a.mood.tension).toBeGreaterThan(0.5);
    expect(a.mood.valence).toBeLessThan(0);
  });
  it('ловит тёплый день с близким человеком', () => {
    const a = fallbackAnalysis('Гуляли с девушкой по парку, смеялись, пили какао, было тепло и уютно', '2026-10-18', [photo({ warmth: 0.6, brightness: 0.6 })]);
    expect(a.setting).toBe('nature');
    expect(a.people).toBe('pair');
    expect(a.mood.valence).toBeGreaterThan(0.3);
    expect(validateTitle(a.title).ok).toBe(true);
  });
  it('сезон по дате: январь — зима, июль — лето', () => {
    expect(fallbackAnalysis('день', '2026-01-10', [photo()]).season).toBe('winter');
    expect(fallbackAnalysis('день', '2026-07-10', [photo()]).season).toBe('summer');
  });
});

describe('час съёмки из EXIF (план 20.11, A2)', () => {
  it('без слов о времени берём час фото', () => {
    expect(fallbackAnalysis('гуляли по парку', '2026-10-18', [], 19).timeOfDay).toBe('evening');
    expect(fallbackAnalysis('гуляли по парку', '2026-10-18', [], 8).timeOfDay).toBe('morning');
    expect(fallbackAnalysis('гуляли по парку', '2026-10-18', [], 2).timeOfDay).toBe('night');
  });
  it('слова записи важнее часов камеры', () => {
    expect(fallbackAnalysis('утром гуляли по парку', '2026-10-18', [], 21).timeOfDay).toBe('morning');
  });
});
