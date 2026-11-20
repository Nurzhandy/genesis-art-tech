import { describe, expect, it } from 'vitest';
import { FIXTURES } from '@/lib/fixtures';
import { buildStyle } from './buildStyle';
import { ageEffect, ageReason, buildVisual } from './visual';

const input = (name: string) => FIXTURES.find((f) => f.name === name)!.input;

describe('живой кадр (B11)', () => {
  it('V8: люди на фото → прописаны чётко, фон впечатлением; без людей — как раньше', () => {
    const pair = buildVisual(input('autumn-park'));
    expect(pair.visual.portrait).toMatchObject({ focusPeople: true, backdrop: 0.38 });
    expect(pair.reasons.find((r) => r.param === 'portrait')?.because).toMatch(/чётко/);
    const none = buildVisual({ ...input('neutral'), analysis: { ...input('neutral').analysis, people: 'unknown' } });
    expect(none.visual.portrait.focusPeople).toBe(false);
  });

  it('V2: энергичная песня дышит сильнее спокойной', () => {
    expect(buildVisual(input('office-night')).visual.rhythm.breath).toBeGreaterThan(buildVisual(input('rainy-alone')).visual.rhythm.breath);
  });

  it('V4: ночь — натриевые фонари; плотная облачность — пасмурный свет', () => {
    expect(buildVisual(input('office-night')).visual.light.kind).toBe('night');
    const cloudy = buildVisual({ ...input('autumn-park'), weather: { tempC: 5, precipitationMm: 0, snowfallCm: 0, cloudCover: 90 } });
    expect(cloudy.visual.light.kind).toBe('overcast');
    expect(cloudy.reasons.find((r) => r.param === 'light')?.because).toContain('90%');
  });

  it('V11: ветер 7 м/с с запада сносит мазки на восток', () => {
    const w = buildVisual({ ...input('rainy-alone'), weather: { tempC: 8, precipitationMm: 4, snowfallCm: 0, cloudCover: 80, windMs: 7, windDeg: 270 } });
    expect(w.visual.wind.strength).toBeCloseTo(7 / 12, 2);
    expect(Math.cos(w.visual.wind.angle)).toBeGreaterThan(0.99);   // дует на восток (вправо)
    expect(w.reasons.find((r) => r.param === 'wind')?.because).toMatch(/7 м\/с с запада/);
  });

  it('стиль детерминирован и старые поля на месте', () => {
    expect(buildStyle(input('autumn-park')).visual).toEqual(buildStyle(input('autumn-park')).visual);
  });

  it('V6: память стареет — за 3 года до −35% насыщенности, свежий день без изменений', () => {
    expect(ageEffect('2026-11-20', '2026-11-20').desat).toBe(0);
    expect(ageReason(ageEffect('2026-11-20', '2026-11-25'))).toBeNull();
    const two = ageEffect('2024-11-20', '2026-11-20');
    expect(two.desat).toBeCloseTo(0.233, 2);
    expect(ageReason(two)?.because).toMatch(/2 г\. → цвета выцвели на 23%/);
    expect(ageEffect('2020-01-01', '2026-11-20').desat).toBe(0.35);
  });
});
