// Полка дневников (спека 2026-11-20-shelf-and-free-page): сколько угодно дневников под разные сферы.
// Логина нет: ключ дневника = его id, а полка — список этих ключей на устройстве.
import { z } from 'zod';

export type DiaryKind = 'memories' | 'travel' | 'work' | 'insights' | 'custom';

export interface DiaryMeta {
  id: string; title: string; kind: DiaryKind; createdAt: string;
  dayCount: number; lastColor: string | null; lastPosterUrl?: string;
}

/** Вид дневника меняет обложку, подсказку в форме и название по умолчанию — не правила стиля. */
export const DIARY_KINDS: Record<DiaryKind, { label: string; icon: string; cover: string; prompt: string; defaultTitle: string }> = {
  memories: { label: 'воспоминания', icon: '✦', cover: '#b5653a', prompt: 'Расскажите как другу: погода, свет, запахи, звуки, кто был рядом, мелочи, которые запомнились…', defaultTitle: 'Мои дни' },
  travel: { label: 'путешествия', icon: '✈', cover: '#2f6f73', prompt: 'Где вы были? Дорога, город, запахи, люди, что удивило в пути…', defaultTitle: 'Путешествия' },
  work: { label: 'работа и учёба', icon: '▤', cover: '#3d4b6b', prompt: 'Что было сегодня в работе или учёбе: задача, команда, сдача, что получилось…', defaultTitle: 'Работа' },
  insights: { label: 'инсайты и идеи', icon: '✺', cover: '#8a6d1f', prompt: 'Какая мысль сегодня не отпускает? Где она пришла, что вокруг звучало и было видно…', defaultTitle: 'Инсайты' },
  custom: { label: 'свой', icon: '❀', cover: '#7a4a6a', prompt: 'Расскажите о дне так, как хочется…', defaultTitle: 'Новый дневник' },
};

/** Вопросы над полем записи (ресерч 20.11, W9 по мотивам Stoic): сменяют друг друга и подсказывают детали. */
const COMMON_QUESTIONS = ['Какая была погода?', 'Чем пахло?', 'Какой звук запомнился?', 'Кто был рядом?', 'Какой был свет?', 'Какая мелочь запомнилась?'];
export const KIND_QUESTIONS: Record<DiaryKind, string[]> = {
  memories: ['Что сегодня хочется запомнить?', ...COMMON_QUESTIONS],
  travel: ['Где вы были сегодня?', 'Что удивило в дороге?', 'Как звучал этот город?', ...COMMON_QUESTIONS],
  work: ['Что сегодня получилось?', 'Кто был в команде?', 'Что звучало в наушниках?', 'Какой был свет за окном?', 'Что хочется запомнить из этого дня?'],
  insights: ['Какая мысль не отпускает?', 'Где она пришла?', 'Что звучало в этот момент?', 'Что было перед глазами?', 'Кому хочется её рассказать?'],
  custom: ['Каким был ваш день?', ...COMMON_QUESTIONS],
};

export const DiaryKindSchema = z.enum(['memories', 'travel', 'work', 'insights', 'custom']);
export const NewDiaryInput = z.object({ title: z.string().trim().min(1).max(60), kind: DiaryKindSchema });
export const RenameDiaryInput = z.object({ title: z.string().trim().min(1).max(60) });

export function parseShelf(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0))] : [];
  } catch {
    return [];
  }
}

/** Устройство из времён «одного дневника»: его ключ становится первым дневником на полке. */
export function migrateShelf(raw: string | null, legacyKey: string | null): string[] {
  const list = parseShelf(raw);
  return legacyKey && !list.includes(legacyKey) ? [...list, legacyKey] : list;
}
