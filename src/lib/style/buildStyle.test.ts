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

describe('buildStyle: атмосферный слой (R3)', () => {
  it('осенний парк → падающие листья', () => {
    expect(s('autumn-park').atmosphere.kind).toBe('leaves');
  });
  it('ночь в офисе → огни города', () => {
    expect(s('office-night').atmosphere.kind).toBe('lights');
  });
  it('«стук дождя» в деталях → капли дождя', () => {
    expect(s('rainy-alone').atmosphere.kind).toBe('rain');
  });
  it('зимний вечер → снег', () => {
    expect(s('grandma-old-song').atmosphere.kind).toBe('snow');
  });
  it('нейтральный день → без слоя', () => {
    expect(s('neutral').atmosphere.kind).toBe('none');
  });
  it('«парк» не путается с «паром»', () => {
    const inp = input('neutral');
    const withPark = { ...inp, analysis: { ...inp.analysis, sensory: ['тишина в парке'] } };
    expect(buildStyle(withPark).atmosphere.kind).toBe('none');
    const withTea = { ...inp, analysis: { ...inp.analysis, sensory: ['пар от чая'] } };
    expect(buildStyle(withTea).atmosphere.kind).toBe('mist');
  });
  it('плотность растёт с энергией песни: 0.3 + 0.5·energy', () => {
    expect(s('office-night').atmosphere.amount).toBeCloseTo(0.3 + 0.5 * 0.85, 2);
  });
  it('причина слоя записана в reasons', () => {
    expect(s('rainy-alone').reasons.some((r) => r.param === 'atmosphere' && /дожд/.test(r.because))).toBe(true);
  });
});

import { MUSIC_PRESETS } from './musicPresets';

describe('buildStyle: та же запись, другая песня (R5)', () => {
  const withSong = (name: Name, id: string) => buildStyle({ ...input(name), music: MUSIC_PRESETS.find((p) => p.id === id)!.music });
  it('энергичная песня ускоряет смену кадров на тех же фото', () => {
    expect(withSong('autumn-park', 'techno').motion.beatsPerPhoto).toBeLessThan(withSong('autumn-park', 'ambient').motion.beatsPerPhoto);
  });
  it('минорная тихая песня даёт больше воздуха, чем бодрый поп', () => {
    expect(withSong('autumn-park', 'ambient').composition.negativeSpace).toBeGreaterThan(withSong('autumn-park', 'pop').composition.negativeSpace);
  });
  it('старая песня даёт больше зерна, чем современная', () => {
    expect(withSong('autumn-park', 'sinatra').texture.grain).toBeGreaterThan(withSong('autumn-park', 'techno').texture.grain);
  });
  it('в причинах видно, что энергия песни сдвинула темп дня', () => {
    expect(withSong('autumn-park', 'techno').reasons.find((r) => r.param === 'motion')?.because).toMatch(/песн/);
  });
});

describe('buildStyle: поправка человека «Не совсем так?» (R10)', () => {
  const over = (name: Name, warmth: number, energy: number) => buildStyle({ ...input(name), moodOverride: { warmth, energy } });
  it('без поправки (null) — как решила система', () => {
    expect(buildStyle({ ...input('autumn-park'), moodOverride: null })).toEqual(s('autumn-park'));
  });
  it('«теплее» сдвигает палитру к теплу', () => {
    expect(warmthOf(over('office-night', 0.4, 0).palette.accents)).toBeGreaterThan(warmthOf(s('office-night').palette.accents));
  });
  it('«живее» ускоряет ритм', () => {
    expect(over('autumn-park', 0, 0.4).motion.beatsPerPhoto).toBeLessThan(s('autumn-park').motion.beatsPerPhoto);
  });
  it('поправка ограничена ±0.4', () => {
    expect(over('autumn-park', 5, -5)).toEqual(over('autumn-park', 0.4, -0.4));
  });
  it('в «Почему так» видно, что сделал человек', () => {
    const r = over('autumn-park', 0.2, -0.1).reasons.find((x) => x.param === 'override')?.because ?? '';
    expect(r).toMatch(/теплее на 0\.2/);
    expect(r).toMatch(/спокойнее на 0\.1/);
  });
});

describe('buildStyle: атмосфера, найдено при тестировании', () => {
  it('«жёлтые листья» в деталях → листья, даже если место «у воды»', () => {
    const inp = input('neutral');
    const day = { ...inp, analysis: { ...inp.analysis, setting: 'water' as const, sensory: ['парку', 'жёлтых листьях', 'холодно'] } };
    expect(buildStyle(day).atmosphere.kind).toBe('leaves');
  });
  it('осень у воды (пруд в парке) → листья', () => {
    const inp = input('neutral');
    expect(buildStyle({ ...inp, analysis: { ...inp.analysis, setting: 'water' as const } }).atmosphere.kind).toBe('leaves');
  });
  it('«корицей» и «какао» в подписи → пар, если нет листьев и осадков', () => {
    const inp = input('neutral');
    const day = { ...inp, analysis: { ...inp.analysis, season: 'spring' as const, caption: 'пахло корицей и какао' } };
    expect(buildStyle(day).atmosphere.kind).toBe('mist');
  });
});

describe('buildStyle: погода и обложка альбома (план 20.11, B1)', () => {
  const wx = (o: Partial<import('@/lib/types').DayWeather>) => ({ tempC: 8, precipitationMm: 0, snowfallCm: 0, cloudCover: 30, place: 'Астана', ...o });
  const withWx = (name: Name, o: Partial<import('@/lib/types').DayWeather>) => buildStyle({ ...input(name), weather: wx(o) });

  it('в тот день шёл дождь → капли, причина с городом и миллиметрами', () => {
    const st = withWx('neutral', { precipitationMm: 4 });
    expect(st.atmosphere.kind).toBe('rain');
    expect(st.reasons.find((r) => r.param === 'atmosphere')?.because).toMatch(/Астан.*4 мм|4 мм.*Астан/);
  });
  it('снегопад → снег, даже осенью', () => {
    expect(withWx('autumn-park', { snowfallCm: 2, tempC: -3 }).atmosphere.kind).toBe('snow');
  });
  it('осадки в мороз → снег', () => {
    expect(withWx('neutral', { precipitationMm: 3, tempC: -6 }).atmosphere.kind).toBe('snow');
  });
  it('ясная погода не отменяет «дождь» из слов записи', () => {
    expect(withWx('rainy-alone', { precipitationMm: 0 }).atmosphere.kind).toBe('rain');
  });
  it('мороз холодит палитру, жара — греет', () => {
    const base = warmthOf(s('autumn-park').palette.accents);
    expect(warmthOf(withWx('autumn-park', { tempC: -12 }).palette.accents)).toBeLessThan(base);
    expect(warmthOf(withWx('autumn-park', { tempC: 30 }).palette.accents)).toBeGreaterThan(base);
  });
  it('пасмурный день приглушает цвета', () => {
    const chroma = (hexes: string[]) => hexes.reduce((a, h) => a + hexToOklch(h).c, 0) / hexes.length;
    expect(chroma(withWx('summer-friends', { cloudCover: 95 }).palette.accents)).toBeLessThan(chroma(s('summer-friends').palette.accents));
  });
  it('без погоды всё как раньше', () => {
    expect(buildStyle({ ...input('autumn-park'), weather: null })).toEqual(s('autumn-park'));
  });
  it('цвет обложки альбома подмешивается в акценты и объясняется', () => {
    const inp = input('office-night');
    const st = buildStyle({ ...inp, music: { ...inp.music, coverPalette: ['#f2b705', '#d94f04', '#f2e8cf'] } });
    expect(warmthOf(st.palette.accents)).toBeGreaterThan(warmthOf(s('office-night').palette.accents));
    expect(st.reasons.some((r) => r.param === 'cover' && /обложк/.test(r.because))).toBe(true);
  });
  it('погода видна в «Почему так»', () => {
    expect(withWx('autumn-park', { tempC: -12 }).reasons.some((r) => r.param === 'weather' && /−12|-12/.test(r.because))).toBe(true);
  });
});

describe('buildStyle: звук дня в причинах (B4)', () => {
  it('у атмосферы указан её звук', () => {
    expect(s('rainy-alone').reasons.find((r) => r.param === 'atmosphere')?.because).toMatch(/звук: шум дождя и капли/);
  });
});
