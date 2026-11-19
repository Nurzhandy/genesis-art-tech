// Анализ дня без AI: словарь + дата + цвета фото. Используется, если Claude недоступен (A3).
import type { DayAnalysis, PhotoFeatures } from '@/lib/types';

type Season = DayAnalysis['season'];
type TimeOfDay = DayAnalysis['timeOfDay'];
type Setting = DayAnalysis['setting'];

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));
const count = (text: string, words: string[]) => words.filter((w) => text.includes(w)).length;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const r2 = (v: number) => Math.round(v * 100) / 100;

const POS = ['смея', 'смех', 'счаст', 'рад', 'тепл', 'уют', 'любл', 'красив', 'весел', 'весёл', 'обнима', 'улыб', 'кайф', 'класс', 'здорово', 'прекрас', 'нежн', 'вкусн'];
const NEG = ['устал', 'груст', 'плак', 'одинок', 'тоск', 'нерв', 'злил', 'зло', 'страш', 'боль', 'болел', 'тяжел', 'тяжёл', 'скучн', 'ссор', 'плохо'];
const HIGH = ['бега', 'танц', 'шумн', 'быстр', 'концерт', 'вечеринк', 'праздн', 'громк', 'много', 'спешил', 'кричал', 'прыга', 'дедлайн', 'срочн'];
const LOW = ['тихо', 'тишин', 'спокойн', 'медленн', 'дремал', 'лежал', 'читал', 'дождь', 'одна', 'один', 'сонн'];
const TENSE = ['дедлайн', 'сдач', 'срочн', 'экзамен', 'нерв', 'стресс', 'опаздыв', 'аврал', 'не успева'];
const NOSTALGIC = ['детств', 'бабушк', 'дедушк', 'вспомин', 'как раньше', 'стар', 'пластинк', 'фотоальбом', 'школ', 'родител'];

function seasonOf(date: string): Season {
  const m = Number(date.slice(5, 7));
  if (!m) return 'unknown';
  return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn';
}

function timeOf(t: string): TimeOfDay {
  if (has(t, ['ночь', 'ночью', 'ночи', 'полночь'])) return 'night';
  if (has(t, ['вечер', 'закат'])) return 'evening';
  if (has(t, ['утро', 'утром', 'рассвет', 'проснул'])) return 'morning';
  if (has(t, ['днём', 'днем', 'обед'])) return 'day';
  return 'unknown';
}

function settingOf(t: string): Setting {
  if (has(t, ['офис', 'дома', 'комнат', 'квартир', 'кухн', 'кафе', 'кофейн', 'универ', 'школ', 'аудитори'])) return 'indoor';
  if (has(t, ['пруд', 'озер', 'озёр', 'мор', 'рек', 'пляж'])) return 'water';
  if (has(t, ['парк', 'лес', 'гор', 'пол', 'сад', 'природ', 'листь'])) return 'nature';
  if (has(t, ['поезд', 'самолёт', 'самолет', 'автобус', 'метро', 'дорог', 'машин'])) return 'transport';
  if (has(t, ['город', 'улиц', 'центр', 'проспект'])) return 'city';
  return 'mixed';
}

function peopleOf(t: string): DayAnalysis['people'] {
  if (has(t, ['друзья', 'друзьями', 'компани', 'все вместе', 'семьёй', 'семьей', 'толп'])) return 'group';
  if (has(t, ['с девушкой', 'с парнем', 'с мамой', 'с папой', 'с другом', 'с подругой', 'с бабушкой', 'с дедушкой', 'вдвоём', 'вдвоем', 'с женой', 'с мужем'])) return 'pair';
  if (has(t, ['один', 'одна', 'сам с собой', 'одиноч'])) return 'alone';
  if (/\bмы\b|гуляли|смеялись|разговаривали|пили/.test(t)) return 'pair';
  return 'unknown';
}

const SEASON_ADJ: Record<Season, { m: string; n: string; f: string }> = {
  autumn: { m: 'Осенний', n: 'Осеннее', f: 'Осенняя' },
  winter: { m: 'Зимний', n: 'Зимнее', f: 'Зимняя' },
  spring: { m: 'Весенний', n: 'Весеннее', f: 'Весенняя' },
  summer: { m: 'Летний', n: 'Летнее', f: 'Летняя' },
  unknown: { m: 'Тихий', n: 'Тихое', f: 'Тихая' },
};

const NOUN: Record<TimeOfDay, { word: string; g: 'm' | 'n' | 'f' }> = {
  morning: { word: 'утро', g: 'n' }, day: { word: 'день', g: 'm' }, evening: { word: 'вечер', g: 'm' },
  night: { word: 'ночь', g: 'f' }, unknown: { word: 'день', g: 'm' },
};

const PLACE: Record<Setting, string> = {
  nature: 'в парке', city: 'в городе', indoor: 'дома', water: 'у воды', transport: 'в дороге', mixed: '',
};

export function fallbackTitle(season: Season, time: TimeOfDay, setting: Setting, valence: number, tension: number): string {
  const noun = NOUN[time];
  const adj = SEASON_ADJ[season][noun.g];
  const place = PLACE[setting];
  const tail = tension > 0.6 ? 'на нервах' : valence > 0.3 ? 'с тёплым настроением' : valence < -0.3 ? 'в тишине' : 'без особых событий';
  return place ? `${adj} ${noun.word} ${place} ${tail === 'без особых событий' ? '' : tail}`.trim() : `${adj} ${noun.word} ${tail}`;
}

export function fallbackAnalysis(rawText: string, date: string, photos: PhotoFeatures[]): DayAnalysis {
  const t = rawText.toLocaleLowerCase('ru');
  const meanWarmth = photos.length ? photos.reduce((a, p) => a + p.warmth, 0) / photos.length : 0;
  const meanBright = photos.length ? photos.reduce((a, p) => a + p.brightness, 0) / photos.length : 0.5;

  const pos = count(t, POS);
  const neg = count(t, NEG);
  const valence = r2(clamp(0.25 * (pos - neg) + 0.2 * meanWarmth + 0.2 * (meanBright - 0.5), -1, 1));
  const arousal = r2(clamp(0.4 + 0.15 * count(t, HIGH) - 0.12 * count(t, LOW)));
  const tension = r2(clamp(0.1 + 0.3 * count(t, TENSE) + (has(t, ['ночь', 'ночью']) && count(t, TENSE) ? 0.1 : 0)));
  const nostalgia = r2(clamp(0.1 + 0.25 * count(t, NOSTALGIC)));

  const season = seasonOf(date);
  const timeOfDay = timeOf(t);
  const setting = settingOf(t);
  const people = peopleOf(t);

  const moodWords = [
    valence > 0.3 ? 'тёплый' : valence < -0.3 ? 'грустный' : 'ровный',
    arousal > 0.6 ? 'насыщенный' : arousal < 0.35 ? 'тихий' : 'обычный',
    tension > 0.5 ? 'напряжённый' : 'спокойный',
  ];

  const firstSentence = rawText.split(/[.!?\n]/)[0]?.trim() ?? '';
  const caption = (firstSentence.length > 3 ? firstSentence : 'просто день').toLocaleLowerCase('ru').slice(0, 60);

  return {
    mood: { valence, arousal, tension, nostalgia },
    moodWords,
    season, timeOfDay, setting, people,
    sensory: [],
    photoScenes: photos.map((p) => ({
      index: p.index,
      subject: 'фото дня',
      light: p.brightness < 0.3 ? 'low' : p.warmth > 0.3 ? 'warm' : p.warmth < -0.3 ? 'cool' : 'neutral',
    })),
    title: fallbackTitle(season, timeOfDay, setting, valence, tension),
    caption,
    songGuess: null,
    source: 'fallback',
  };
}
