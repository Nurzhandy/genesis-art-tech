// Режим «Рисунок»: что нарисовать на странице дня — как иллюстрация из книжки по записи, погоде и фото.
// Лето на природе вдвоём → солнце, трава, птицы, плед; дождь → тучи; ночь в городе → огни и луна.
import type { StyleInput, StyleReason } from '@/lib/types';
import { signals } from './signals';

export type SceneSky = 'day' | 'golden' | 'dusk' | 'night';
export type SceneSetting = 'meadow' | 'park' | 'water' | 'city' | 'home' | 'road';
export type SceneWeather = 'clear' | 'cloudy' | 'rain' | 'snow';

export interface SceneParams {
  sky: SceneSky;
  setting: SceneSetting;
  season: 'winter' | 'spring' | 'summer' | 'autumn';
  weather: SceneWeather;
  people: 0 | 1 | 2 | 3;
  birds: boolean;
  picnic: boolean;
  steam: boolean;      // чашка с паром дома (какао, чай, кофе)
}

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

export function buildScene(input: StyleInput): { scene: SceneParams; reason: StyleReason } {
  const a = input.analysis;
  const s = signals(input);
  const words = [...a.sensory, ...a.moodWords, a.caption, ...a.photoScenes.map((p) => p.subject)].join(' ').toLocaleLowerCase('ru');
  const wx = input.weather ?? null;

  const sky: SceneSky = a.timeOfDay === 'night' ? 'night' : a.timeOfDay === 'evening' ? (s.warmLight ? 'golden' : 'dusk') : a.timeOfDay === 'morning' && s.warmLight ? 'golden' : 'day';
  const weather: SceneWeather =
    (wx && wx.snowfallCm >= 0.5) || has(words, ['снег', 'снеж']) ? 'snow'
      : (wx && wx.precipitationMm >= 1) || has(words, ['дожд', 'ливн', 'морос']) ? 'rain'
        : (wx && wx.cloudCover >= 75) || has(words, ['пасмурн', 'туман', 'серо']) ? 'cloudy' : 'clear';
  const season = a.season === 'unknown' ? (Number(input.date.slice(5, 7)) % 12 < 3 ? 'winter' : Number(input.date.slice(5, 7)) < 6 ? 'spring' : Number(input.date.slice(5, 7)) < 9 ? 'summer' : 'autumn') : a.season;
  const setting: SceneSetting =
    a.setting === 'water' ? 'water' : a.setting === 'city' ? 'city' : a.setting === 'indoor' ? 'home' : a.setting === 'transport' ? 'road'
      : has(words, ['парк', 'лес', 'дерев', 'аллея']) ? 'park' : 'meadow';
  const people = a.people === 'alone' ? 1 : a.people === 'pair' ? 2 : a.people === 'group' ? 3 : 0;
  const outdoors = setting !== 'home';
  const picnic = outdoors && (setting === 'meadow' || setting === 'park') && people >= 2 && (season === 'summer' || season === 'spring') && weather === 'clear';
  const birds = outdoors && sky !== 'night' && weather === 'clear' && setting !== 'city';
  const steam = has(words, ['какао', 'чай', 'кофе', 'глинтвейн', 'пар']);

  const scene: SceneParams = { sky, setting, season, weather, people, birds, picnic, steam };
  const SKY = { day: 'дневное небо', golden: 'золотой свет', dusk: 'сумерки', night: 'ночь со звёздами' };
  const PLACE = { meadow: 'луг', park: 'парк с деревьями', water: 'вода и горизонт', city: 'город', home: 'комната с окном', road: 'дорога' };
  const WX = { clear: weather === 'clear' && sky !== 'night' ? 'солнце' : 'ясно', cloudy: 'облака', rain: 'тучи и дождь', snow: 'снег' };
  const extras = [picnic && 'плед для пикника', birds && 'птицы', steam && 'чашка с паром', people && `${people === 3 ? 'компания' : people === 2 ? 'двое' : 'человек'}`].filter(Boolean);
  return {
    scene,
    reason: { param: 'scene', because: `Рисунок дня: ${PLACE[setting]}, ${SKY[sky]}, ${WX[weather]}${extras.length ? `, ${extras.join(', ')}` : ''} — всё из записи, погоды и фото` },
  };
}
