// Авто-стикеры (спека 2026-11-20): если времени нет, система сама раскладывает 2–4 стикера по записи —
// по тем же правилам «вход → форма → причина», что и весь стиль. Человек потом может всё поменять.
import { LAYOUT } from '@/lib/style/constants';
import type { DayAnalysis } from '@/lib/types';
import type { Decor, DecorColor, DecorItem, StickerShape } from './decor';

const W = LAYOUT.width, H = LAYOUT.height;

/** Слова записи → стикер. Порядок важен: сначала самые «личные» детали. */
const WORD_RULES: { stems: string[]; shape: StickerShape }[] = [
  { stems: ['какао', 'кофе', 'чай', 'чая', 'капучино', 'латте', 'глинтвейн'], shape: 'cup' },
  { stems: ['дожд', 'ливн', 'морос', 'лужи'], shape: 'drop' },
  { stems: ['снег', 'снеж', 'сугроб'], shape: 'snowflake' },
  { stems: ['музык', 'песн', 'гитар', 'концерт', 'пел ', 'пели', 'пластинк'], shape: 'note' },
  { stems: ['мор', 'озер', 'озёр', 'рек', 'пляж', 'волн'], shape: 'wave' },
  { stems: ['цвет', 'букет', 'сирен', 'тюльпан', 'роз'], shape: 'flower' },
  { stems: ['люб', 'обня', 'обним', 'свидан', 'поцел'], shape: 'heart' },
  { stems: ['билет', 'поезд', 'самолёт', 'самолет', 'вокзал', 'аэропорт'], shape: 'ticket' },
  { stems: ['солнц', 'жара', 'загорал'], shape: 'sun' },
];
const SEASON: Partial<Record<DayAnalysis['season'], StickerShape>> = { autumn: 'leaf', winter: 'snowflake', spring: 'flower', summer: 'sun' };
const SEASON_RU: Record<string, string> = { autumn: 'осень', winter: 'зима', spring: 'весна', summer: 'лето' };
const NAMES: Partial<Record<StickerShape, string>> = { cup: 'чашка', drop: 'капля', snowflake: 'снежинка', note: 'нота', wave: 'волна', flower: 'цветок', heart: 'сердце', ticket: 'билет', sun: 'солнце', leaf: 'лист', star: 'звезда', sparkle: 'искра' };

/** Свободные места: угол фото, низ страницы, справа от подписи, справа от короткого названия. */
function spots(titleLen: number): { x: number; y: number }[] {
  const z = LAYOUT.photo;
  const list = [
    { x: z.x * W + 6, y: z.y * H + 4 },                        // верхний левый угол фото — как наклейка на край
    { x: 0.55 * W, y: 0.922 * H },                             // между подписью и нижней строкой (там длинное имя песни)
    { x: 0.87 * W, y: (LAYOUT.caption.y + LAYOUT.caption.h / 2) * H },   // справа от рукописной подписи
  ];
  if (titleLen <= 18) list.push({ x: 0.86 * W, y: 0.125 * H });        // справа от короткого названия
  return list;
}

const rand = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

export function autoDecor(analysis: DayAnalysis, text: string, seed: number): { decor: Decor; because: string } {
  const t = ` ${text.toLocaleLowerCase('ru')} ${analysis.sensory.join(' ').toLocaleLowerCase('ru')} `;
  const picked: { shape: StickerShape; why: string }[] = [];
  const add = (shape: StickerShape, why: string) => { if (!picked.some((p) => p.shape === shape)) picked.push({ shape, why }); };

  for (const r of WORD_RULES) {
    const stem = r.stems.find((s) => t.includes(s));
    if (stem) {
      const word = t.slice(t.indexOf(stem)).match(/^[\p{L}-]+/u)?.[0] ?? stem.trim();
      add(r.shape, `«${word}» в записи → ${NAMES[r.shape]}`);
    }
  }
  const season = SEASON[analysis.season];
  if (season) add(season, `${SEASON_RU[analysis.season]} → ${NAMES[season]}`);
  if (analysis.timeOfDay === 'night') add('star', `ночь → ${NAMES.star}`);
  // Тихий день без примет: искра и печать дневника, чтобы страница не была голой.
  for (const f of ['sparkle', 'stamp'] as const) if (picked.length < 2) add(f, `день без особых примет → ${NAMES[f] ?? 'печать'}`);

  const r = rand(seed);
  const places = spots(analysis.title.length);
  const colors: DecorColor[] = ['a0', 'a1', 'a2', 'ink'];
  const chosen = picked.slice(0, Math.min(4, places.length));
  const items: DecorItem[] = chosen.map((p, i) => ({
    id: `auto-${i}`, kind: 'sticker', shape: p.shape,
    x: Math.round(places[i].x), y: Math.round(places[i].y),
    scale: Math.round((0.62 + r() * 0.16) * 100) / 100,
    rot: Math.round(r() * 30 - 15),
    color: colors[i % colors.length],
  }));
  return { decor: { v: 1, source: 'auto', items }, because: `Стикеры положила система: ${chosen.map((p) => p.why).join(', ')}. Их можно передвинуть или убрать в «Украсить страницу»` };
}
