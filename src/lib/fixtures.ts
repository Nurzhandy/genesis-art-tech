// Фикстуры дней для /lab и тестов рендера.
import type { StyleInput } from './types';
import autumnPark from '../../fixtures/days/autumn-park.json';
import officeNight from '../../fixtures/days/office-night.json';
import rainyAlone from '../../fixtures/days/rainy-alone.json';
import summerFriends from '../../fixtures/days/summer-friends.json';
import grandma from '../../fixtures/days/grandma-old-song.json';
import neutral from '../../fixtures/days/neutral.json';

export interface Fixture { name: string; input: StyleInput; photos: string[]; song: string }

const raw = { 'autumn-park': autumnPark, 'office-night': officeNight, 'rainy-alone': rainyAlone, 'summer-friends': summerFriends, 'grandma-old-song': grandma, neutral };
const SONGS: Record<string, string> = {
  'autumn-park': 'Frank Sinatra — Autumn Leaves', 'office-night': 'электроника, 128 BPM', 'rainy-alone': 'эмбиент',
  'summer-friends': 'летний поп', 'grandma-old-song': 'пластинка 1975 года', neutral: '',
};

export const FIXTURES: Fixture[] = Object.entries(raw).map(([name, f]) => ({
  name, input: f.input as unknown as StyleInput, photos: f.photos, song: SONGS[name],
}));
