import { describe, expect, it } from 'vitest';
import type { StyleInput } from '@/lib/types';
import { buildStyle } from './buildStyle';
import { buildStamps, stampDate } from './stamps';
import autumnPark from '../../../fixtures/days/autumn-park.json';
import officeNight from '../../../fixtures/days/office-night.json';
import grandma from '../../../fixtures/days/grandma-old-song.json';
import neutral from '../../../fixtures/days/neutral.json';

const inp = (f: { input: unknown }) => f.input as StyleInput;
const texts = (i: StyleInput, primary = buildStyle(i).techniques.primary) => buildStamps(i, primary).stamps.tags.map((t) => t.text);

describe('buildStamps', () => {
  it('штампы берутся только из анализа: место и люди', () => {
    const t = texts(inp(autumnPark));
    expect(t).toContain('на природе');
    expect(t).toContain('вдвоём');
    expect(t.some((x) => /осень/.test(x))).toBe(true);
  });
  it('у нейтрального дня — только сезон и время суток', () => {
    expect(texts(inp(neutral))).toEqual(['осень · день']);
  });
  it('погода того дня важнее сезона', () => {
    const i = { ...inp(neutral), weather: { tempC: -3.4, precipitationMm: 0, snowfallCm: 2, cloudCover: 90 } };
    expect(texts(i)[0]).toBe('−3° · снег');
  });
  it('форма штампа следует технике', () => {
    expect(buildStamps(inp(officeNight), 'geometric').stamps.shape).toBe('square');
    expect(buildStamps(inp(grandma), 'film').stamps.shape).toBe('ticket');
    expect(buildStamps(inp(autumnPark), 'impressionist').stamps.shape).toBe('circle');
  });
  it('марка сезона и дата штемпеля', () => {
    expect(buildStamps(inp(grandma), 'film').stamps.season).toBe('winter');
    expect(stampDate('2026-10-18')).toBe('18 ОКТ 2026');
  });
  it('причина перечисляет штампы', () => {
    expect(buildStamps(inp(autumnPark), 'impressionist').reason.because).toMatch(/вдвоём/);
  });
  it('buildStyle кладёт штампы в стиль', () => {
    expect(buildStyle(inp(autumnPark)).stamps?.tags.length).toBeGreaterThan(0);
  });
});
