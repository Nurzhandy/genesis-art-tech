// Демо-дни главной (ресерч 20.11, N2/M1): фикстуры лаборатории + короткие записи, как их написал бы человек.
import { FIXTURES } from '@/lib/fixtures';
import { buildStyle } from '@/lib/style/buildStyle';
import { slugify } from '@/lib/title/validateTitle';
import type { StyleParams } from '@/lib/types';

const TEXTS: Record<string, string> = {
  'autumn-park': 'Гуляли по парку, всё в жёлтых листьях. Было холодно, но мы пили какао и долго разговаривали.',
  'office-night': 'Срочная сдача проекта. Ночь в офисе, в наушниках электроника, кофе давно остыл.',
  'rainy-alone': 'Весь вечер шёл дождь. Сидела у окна с чаем, слушала эмбиент и ни о чём не думала.',
  'summer-friends': 'Целый день на озере с друзьями: прыгали с пирса, смеялись до слёз, сгорели на солнце.',
  'grandma-old-song': 'Приехал к бабушке. Она достала старую пластинку, и мы пили чай с вареньем под неё.',
};

export interface DemoDay {
  name: string; text: string; title: string; date: string; caption: string; notes: string[];
  photos: string[]; song: string; bpm: number; moods: string[]; style: StyleParams; folder: string;
}

let cache: DemoDay[] | null = null;
export function demoDays(): DemoDay[] {
  cache ??= FIXTURES.filter((f) => TEXTS[f.name]).map((f) => {
    const a = f.input.analysis;
    return {
      name: f.name, text: TEXTS[f.name], title: a.title, date: f.input.date, caption: a.caption, notes: a.sensory,
      photos: f.photos, song: f.song, bpm: Math.round(f.input.music.bpm), moods: a.moodWords,
      style: buildStyle(f.input), folder: `${f.input.date}-${slugify(a.title)}/`,
    };
  });
  return cache;
}
