import { describe, expect, it } from 'vitest';
import { fallbackAnalysis } from '@/lib/ai/fallback';
import { LAYOUT } from '@/lib/style/constants';
import type { DayAnalysis } from '@/lib/types';
import { autoDecor } from './autoDecor';

const W = LAYOUT.width, H = LAYOUT.height;
const an = (o: Partial<DayAnalysis> = {}): DayAnalysis => ({ ...fallbackAnalysis('день', '2026-10-18', []), ...o });
const shapes = (r: ReturnType<typeof autoDecor>) => r.decor.items.map((i) => (i.kind === 'sticker' ? i.shape : ''));

describe('авто-стикеры по записи', () => {
  it('«пили какао» осенью → чашка и лист, причина называет слово из записи', () => {
    const r = autoDecor(an({ season: 'autumn', title: 'Осенний парк и какао' }), 'Гуляли по парку, было холодно, но мы пили какао', 7);
    expect(shapes(r)).toContain('cup');
    expect(shapes(r)).toContain('leaf');
    expect(r.because).toContain('какао');
    expect(r.decor.source).toBe('auto');
  });
  it('ночь → звезда, дождь → капля, музыка → нота', () => {
    expect(shapes(autoDecor(an({ timeOfDay: 'night' }), 'сидели допоздна', 1))).toContain('star');
    expect(shapes(autoDecor(an(), 'весь вечер шёл дождь', 1))).toContain('drop');
    expect(shapes(autoDecor(an(), 'играла уличная гитара', 1))).toContain('note');
  });
  it('не больше 4 и без повторов формы, хотя бы 2', () => {
    const r = autoDecor(an({ season: 'winter', timeOfDay: 'night' }), 'снег, кофе, дождь, гитара, море, цветы, билет на поезд', 3);
    expect(r.decor.items.length).toBeLessThanOrEqual(4);
    expect(new Set(shapes(r)).size).toBe(r.decor.items.length);
    expect(autoDecor(an({ season: 'unknown', timeOfDay: 'unknown' }), 'обычный день', 3).decor.items.length).toBeGreaterThanOrEqual(2);
  });
  it('стикеры не ложатся на фото и на подпись', () => {
    const z = LAYOUT.photo, inset = 40;
    for (let seed = 0; seed < 20; seed++) {
      for (const it of autoDecor(an({ season: 'autumn', timeOfDay: 'night' }), 'какао, дождь, гитара', seed).decor.items) {
        if (it.kind !== 'sticker') continue;
        const inPhoto = it.x > z.x * W + inset && it.x < (z.x + z.w) * W - inset && it.y > z.y * H + inset && it.y < (z.y + z.h) * H - inset;
        const inCaption = it.y > LAYOUT.caption.y * H && it.y < (LAYOUT.caption.y + LAYOUT.caption.h) * H && it.x < 0.76 * W;
        expect(inPhoto || inCaption).toBe(false);
      }
    }
  });
  it('один и тот же день — одни и те же стикеры', () => {
    const a = autoDecor(an({ season: 'autumn' }), 'какао', 42), b = autoDecor(an({ season: 'autumn' }), 'какао', 42);
    expect(a).toEqual(b);
  });
});
