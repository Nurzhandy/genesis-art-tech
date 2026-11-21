// Трекер эмоций (по мотивам How We Feel и «шкалы настроения» Йельского центра эмоционального интеллекта):
// четыре зоны «энергия × приятность», в каждой — слова-чувства. Человек сам называет, что чувствовал,
// и это сдвигает настроение записи — а значит цвета и ритм страницы. Это не диагноз, а слово самого человека.
import type { DayAnalysis } from './types';

export type Zone = 'bright' | 'calm' | 'tense' | 'low';
export interface Feeling { word: string; zone: Zone; valence: number; arousal: number }

export const ZONES: Record<Zone, { title: string; hint: string; color: string; ink: string }> = {
  bright: { title: 'Ярко', hint: 'много энергии, приятно', color: '#f6c445', ink: '#3a2a00' },
  tense: { title: 'Напряжённо', hint: 'много энергии, неприятно', color: '#e8574a', ink: '#ffffff' },
  calm: { title: 'Спокойно', hint: 'мало энергии, приятно', color: '#5cb88a', ink: '#05261a' },
  low: { title: 'Тихо и грустно', hint: 'мало энергии, неприятно', color: '#5b7fd1', ink: '#ffffff' },
};

const W = (word: string, zone: Zone, valence: number, arousal: number): Feeling => ({ word, zone, valence, arousal });

export const FEELINGS: Feeling[] = [
  W('восторг', 'bright', 0.9, 0.95), W('радость', 'bright', 0.8, 0.75), W('вдохновение', 'bright', 0.7, 0.8),
  W('азарт', 'bright', 0.6, 0.9), W('гордость', 'bright', 0.7, 0.65), W('влюблённость', 'bright', 0.85, 0.7),
  W('спокойствие', 'calm', 0.55, 0.15), W('уют', 'calm', 0.7, 0.2), W('нежность', 'calm', 0.75, 0.3),
  W('благодарность', 'calm', 0.7, 0.35), W('умиротворение', 'calm', 0.6, 0.1), W('светлая грусть', 'calm', 0.2, 0.2),
  W('тревога', 'tense', -0.55, 0.8), W('стресс', 'tense', -0.6, 0.85), W('злость', 'tense', -0.75, 0.9),
  W('раздражение', 'tense', -0.5, 0.7), W('волнение', 'tense', -0.2, 0.75), W('растерянность', 'tense', -0.35, 0.6),
  W('грусть', 'low', -0.6, 0.2), W('усталость', 'low', -0.35, 0.1), W('одиночество', 'low', -0.65, 0.15),
  W('тоска', 'low', -0.55, 0.25), W('пустота', 'low', -0.45, 0.05), W('ностальгия', 'low', -0.1, 0.25),
];

export const findFeeling = (word: string | null | undefined) => FEELINGS.find((f) => f.word === word) ?? null;

/**
 * Слово человека важнее догадки модели: настроение записи сдвигается к чувству на 60%,
 * само слово становится первым в «словах настроения».
 */
export function applyFeeling(a: DayAnalysis, word: string | null | undefined): DayAnalysis {
  const f = findFeeling(word);
  if (!f) return a;
  const mix = (from: number, to: number) => Math.round((from * 0.4 + to * 0.6) * 100) / 100;
  return {
    ...a,
    mood: {
      ...a.mood,
      valence: mix(a.mood.valence, f.valence),
      arousal: mix(a.mood.arousal, f.arousal),
      tension: f.zone === 'tense' ? Math.max(a.mood.tension, 0.6) : f.zone === 'calm' ? Math.min(a.mood.tension, 0.3) : a.mood.tension,
      nostalgia: f.word === 'ностальгия' || f.word === 'светлая грусть' ? Math.max(a.mood.nostalgia, 0.6) : a.mood.nostalgia,
    },
    moodWords: [f.word, ...a.moodWords.filter((w) => w !== f.word)].slice(0, 5),
  };
}
