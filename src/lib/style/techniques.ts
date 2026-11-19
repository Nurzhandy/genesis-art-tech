// Скоринг пяти техник (docs/plan/part-B-visual-system.md, B1).
import type { StyleInput, Technique } from '@/lib/types';
import { genreIn, round, signals } from './signals';

export const TECHNIQUES: Technique[] = ['impressionist', 'geometric', 'minimal', 'film', 'collage'];

export const TECHNIQUE_NAMES: Record<Technique, string> = {
  impressionist: 'мазки и свет Моне',
  geometric: 'геометрия Кандинского',
  minimal: 'японский минимализм',
  film: 'плёночная фотография',
  collage: 'коллаж',
};

const b = (cond: boolean) => (cond ? 1 : 0);

export function scoreTechniques(input: StyleInput): Record<Technique, number> {
  const s = signals(input);
  const { setting, people, timeOfDay } = input.analysis;
  return {
    impressionist: round(
      0.45 * (1 - s.arousal) + 0.3 * s.vPos + 0.15 * b(setting === 'nature' || setting === 'water') +
        0.1 * b(s.warmLight) + 0.15 * b(genreIn(s.genre, ['jazz', 'classical', 'swing', 'folk'])),
    ),
    geometric: round(
      0.35 * s.arousal + 0.4 * s.tension + 0.15 * b(timeOfDay === 'night' || setting === 'city' || setting === 'indoor') +
        0.2 * b(genreIn(s.genre, ['electronic', 'techno', 'house', 'drum'])),
    ),
    minimal: round(
      0.4 * (1 - s.arousal) + 0.3 * s.vNeg + 0.2 * b(people === 'alone') +
        0.15 * b(genreIn(s.genre, ['ambient', 'lofi', 'lo-fi', 'classical'])) + 0.1 * b(s.minor),
    ),
    film: round(
      0.55 * s.nostalgia + 0.3 * b(s.year !== null && s.year < 2000) +
        0.1 * b(people === 'pair' || people === 'group') + 0.05 * b(s.warmLight),
    ),
    collage: round(
      0.3 * s.arousal + 0.3 * s.vPos + 0.2 * b(s.photoCount >= 3) + 0.2 * b(people === 'group') +
        0.15 * b(genreIn(s.genre, ['pop', 'hiphop', 'hip-hop', 'rap', 'rock', 'indie'])),
    ),
  };
}

export function pickTechniques(scores: Record<Technique, number>) {
  const ranked = [...TECHNIQUES].sort((x, y) => scores[y] - scores[x]);
  const [primary, second] = ranked;
  const s1 = scores[primary];
  const s2 = scores[second];
  const secondary = s1 > 0 && s2 >= 0.7 * s1 ? second : null;
  const mix = secondary ? round(Math.min(1, 0.35 * (s2 / s1))) : 0;
  return { primary, secondary, mix, scores };
}
