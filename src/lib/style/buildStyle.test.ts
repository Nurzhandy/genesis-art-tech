import { describe, expect, it } from 'vitest';
import type { StyleInput } from '@/lib/types';
import { buildStyle } from './buildStyle';
import { contrastRatio, hexToOklch } from './color';
import { LAYOUT } from './constants';

import autumnPark from '../../../fixtures/days/autumn-park.json';
import officeNight from '../../../fixtures/days/office-night.json';
import rainyAlone from '../../../fixtures/days/rainy-alone.json';
import summerFriends from '../../../fixtures/days/summer-friends.json';
import grandma from '../../../fixtures/days/grandma-old-song.json';
import neutral from '../../../fixtures/days/neutral.json';

const fixtures = {
  'autumn-park': autumnPark,
  'office-night': officeNight,
  'rainy-alone': rainyAlone,
  'summer-friends': summerFriends,
  'grandma-old-song': grandma,
  neutral,
} as const;
type Name = keyof typeof fixtures;

const input = (name: Name) => fixtures[name].input as unknown as StyleInput;
const s = (name: Name) => buildStyle(input(name));

/** Средний «тёплый» сдвиг акцентов: >0 — к оранжевому, <0 — к синему. */
const warmthOf = (hexes: string[]) =>
  hexes.reduce((acc, h) => {
    const { c, h: hue } = hexToOklch(h);
    return acc + c * Math.cos(((hue - 60) * Math.PI) / 180);
  }, 0) / hexes.length;

describe('buildStyle: выбор техники', () => {
  it('спокойный тёплый день в парке под джаз → импрессионизм', () => {
    expect(s('autumn-park').techniques.primary).toBe('impressionist');
  });
  it('ночь в офисе под электронику → геометрия Кандинского', () => {
    expect(s('office-night').techniques.primary).toBe('geometric');
  });
  it('тихий дождливый вечер в одиночестве → минимализм', () => {
    expect(s('rainy-alone').techniques.primary).toBe('minimal');
  });
  it('вечер у бабушки с песней 1975 года → плёнка', () => {
    expect(s('grandma-old-song').techniques.primary).toBe('film');
  });
  it('шумный летний день с друзьями → коллаж', () => {
    expect(s('summer-friends').techniques.primary).toBe('collage');
  });
});

describe('buildStyle: ритм и композиция', () => {
  it('напряжённая быстрая ночь: 2 доли на кадр и резкие переходы', () => {
    expect(s('office-night').motion.beatsPerPhoto).toBe(2);
    expect(s('office-night').motion.easing).toBe('sharp');
  });
  it('спокойный день: 8 долей на кадр и мягкие переходы', () => {
    expect(s('autumn-park').motion.beatsPerPhoto).toBe(8);
    expect(s('autumn-park').motion.easing).toBe('soft');
  });
  it('тихий минорный вечер: много пустоты', () => {
    expect(s('rainy-alone').composition.negativeSpace).toBeGreaterThan(0.6);
  });
  it('старая песня и ностальгия: сильное зерно', () => {
    expect(s('grandma-old-song').texture.grain).toBeGreaterThan(0.5);
  });
  it('длительность всегда в пределах 20..45 с, даже у нейтрального дня', () => {
    for (const name of Object.keys(fixtures) as Name[]) {
      const d = s(name).durationSec;
      expect(d).toBeGreaterThanOrEqual(20);
      expect(d).toBeLessThanOrEqual(45);
    }
  });
});

describe('buildStyle: палитра', () => {
  it('тёплый осенний день теплее ночи в офисе', () => {
    expect(warmthOf(s('autumn-park').palette.accents)).toBeGreaterThan(
      warmthOf(s('office-night').palette.accents),
    );
  });
  it('текст читается на фоне (контраст ≥ 4.5) у всех дней', () => {
    for (const name of Object.keys(fixtures) as Name[]) {
      const { ink, bg } = s(name).palette;
      expect(contrastRatio(ink, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('от 3 до 5 акцентов, все в формате #rrggbb', () => {
    for (const name of Object.keys(fixtures) as Name[]) {
      const { accents } = s(name).palette;
      expect(accents.length).toBeGreaterThanOrEqual(3);
      expect(accents.length).toBeLessThanOrEqual(5);
      for (const a of accents) expect(a).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('buildStyle: система', () => {
  it('детерминирован: один и тот же день → один и тот же стиль', () => {
    expect(s('autumn-park')).toEqual(s('autumn-park'));
  });
  it('у ключевых решений есть человеческая причина', () => {
    const reasons = s('autumn-park').reasons;
    for (const p of ['technique', 'palette', 'motion', 'negativeSpace', 'grain']) {
      expect(reasons.some((r) => r.param === p && r.because.length > 10)).toBe(true);
    }
  });
  it('все числовые параметры 0..1 лежат в своих границах', () => {
    for (const name of Object.keys(fixtures) as Name[]) {
      const st = s(name);
      for (const v of [
        ...Object.values(st.texture),
        st.composition.density, st.composition.negativeSpace, st.composition.asymmetry,
        st.motion.jitter, st.techniques.mix,
      ]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
  it('постоянные элементы одинаковы для всех дней (единый дневник)', () => {
    expect(LAYOUT.width).toBe(1080);
    expect(LAYOUT.height).toBe(1920);
    expect(LAYOUT.margin).toBeCloseTo(0.08);
  });
  it('пять дней из фикстур дают пять разных техник', () => {
    const names: Name[] = ['autumn-park', 'office-night', 'rainy-alone', 'summer-friends', 'grandma-old-song'];
    expect(new Set(names.map((n) => s(n).techniques.primary)).size).toBe(5);
  });
});
