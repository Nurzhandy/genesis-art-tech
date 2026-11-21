// «Видео из фото»: настроение снимков по их цветам и свету → жанр песни → темп кадров.
// Правило объяснимое: тёплые светлые фото — летний поп, тёмные холодные — эмбиент и ночная электроника.
import type { PhotoFeatures } from './types';

export type Vibe = 'summer' | 'golden' | 'dreamy' | 'night' | 'party' | 'calm';

/** id жанров Deezer для чарта /chart/{id}/tracks */
export const VIBES: Record<Vibe, { title: string; why: string; genre: number; bpm: number }> = {
  summer: { title: 'Тёплое лето', why: 'много света и тёплых цветов', genre: 132, bpm: 118 },
  golden: { title: 'Золотой вечер', why: 'тёплый, но мягкий свет', genre: 85, bpm: 96 },
  dreamy: { title: 'Воздушно', why: 'светлые холодные тона', genre: 85, bpm: 100 },
  night: { title: 'Ночь в городе', why: 'тёмные кадры и холодный свет', genre: 106, bpm: 120 },
  party: { title: 'Праздник', why: 'яркие насыщенные цвета и много кадров', genre: 113, bpm: 124 },
  calm: { title: 'Тишина', why: 'приглушённые спокойные цвета', genre: 98, bpm: 80 },
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function photoVibe(photos: PhotoFeatures[]): Vibe {
  const b = avg(photos.map((p) => p.brightness));
  const w = avg(photos.map((p) => p.warmth));
  const s = avg(photos.map((p) => p.saturation));
  if (s > 0.5 && photos.length >= 6) return 'party';
  if (b < 0.32) return w > 0.15 ? 'golden' : 'night';
  if (s < 0.22) return 'calm';
  if (w > 0.2) return b > 0.55 ? 'summer' : 'golden';
  return 'dreamy';
}
