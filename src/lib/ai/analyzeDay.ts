// Один вызов модели (Gemini): текст + фото + песня → DayAnalysis. Любой сбой → запасной анализ (A3).
import { z } from 'zod';
import type { DayAnalysis, PhotoFeatures, SongRef } from '@/lib/types';
import { validateTitle } from '@/lib/title/validateTitle';
import { fallbackAnalysis } from './fallback';
import { createGemini, DEFAULT_GEMINI_MODEL } from './gemini';
import { SYSTEM_PROMPT, userBlock } from './prompts';
import { DayAnalysisSchema, type DayAnalysisRaw } from './schemas';
import { captionFromText, cutAtWord, isFromText, overlap, sensoryFromText } from './userWords';

export interface AnalyzeInput {
  text: string;
  date: string;
  photos: { base64: string; mediaType: 'image/jpeg' }[];
  photoFeatures: PhotoFeatures[];
  song: SongRef;
  photoHour?: number;   // час съёмки из EXIF (план 20.11, A2)
}

export interface LlmRequest {
  system: string;
  /** Фото дня или запись рассказа: всё, что модель должна увидеть или услышать. */
  images: { base64: string; mediaType: string }[];
  text: string;
  schema: object;
}

/** Нейтральный интерфейс модели: вернуть текст JSON или null, если ответ заблокирован. */
export interface LlmLike { generateJson(req: LlmRequest): Promise<string | null> }

let defaultLlm: LlmLike | null | undefined;
export function getLlm(): LlmLike | null {
  if (defaultLlm !== undefined) return defaultLlm;
  const key = process.env.GEMINI_API_KEY;
  defaultLlm = key ? createGemini(key, process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL) : null;
  return defaultLlm;
}

const RESPONSE_SCHEMA = z.toJSONSchema(DayAnalysisSchema, { target: 'draft-7' }) as object;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));

export function parseModelJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return JSON.parse((fenced ? fenced[1] : text).trim());
}

/** Сенсорика только дословно из записи: выдуманное моделью отбрасываем, пусто → берём из текста сами. */
export function userSensory(fromModel: string[], text: string): string[] {
  const seen = new Set<string>();
  const kept = fromModel
    .map((s) => s.replace(/[«»"“”.,!?;:]+/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('ru'))
    .filter((s) => isFromText(s, text) && !seen.has(s) && seen.add(s))
    .slice(0, 4);
  return kept.length >= 2 ? kept : [...new Set([...kept, ...sensoryFromText(text)])].slice(0, 4);
}

/** Подпись — словами автора: если модель пересказала своими словами, берём фразу из записи. */
export function userCaption(fromModel: string, text: string): string {
  const c = cutAtWord(fromModel.replace(/[«»"“”]/g, ''), 60).replace(/[.]+$/u, '').toLocaleLowerCase('ru');
  return c.length > 3 && overlap(c, text) >= 0.6 ? c : captionFromText(text);
}

export function normalize(raw: DayAnalysisRaw, input: AnalyzeInput): DayAnalysis {
  const fb = () => fallbackAnalysis(input.text, input.date, input.photoFeatures, input.photoHour);
  const title = validateTitle(raw.title);
  return {
    mood: {
      valence: clamp(raw.mood.valence, -1, 1),
      arousal: clamp(raw.mood.arousal, 0, 1),
      tension: clamp(raw.mood.tension, 0, 1),
      nostalgia: clamp(raw.mood.nostalgia, 0, 1),
    },
    moodWords: raw.moodWords.slice(0, 5),
    season: raw.season,
    timeOfDay: raw.timeOfDay,
    setting: raw.setting,
    people: raw.people,
    sensory: userSensory(raw.sensory, input.text),
    photoScenes: raw.photoScenes.filter((s) => s.index >= 0 && s.index < Math.max(1, input.photos.length)),
    title: title.ok ? title.title : fb().title,
    caption: userCaption(raw.caption, input.text),
    songGuess: raw.songGuess && input.song.kind !== 'none'
      ? {
          bpm: clamp(raw.songGuess.bpm, 50, 200),
          energy: clamp(raw.songGuess.energy, 0, 1),
          mode: raw.songGuess.mode,
          genre: raw.songGuess.genre.toLowerCase().trim(),
          year: Math.round(clamp(raw.songGuess.year, 1900, 2100)),
        }
      : null,
    source: 'ai',
  };
}

export async function analyzeDay(input: AnalyzeInput, deps: { llm?: LlmLike | null } = {}): Promise<DayAnalysis> {
  const llm = deps.llm === undefined ? getLlm() : deps.llm;
  const fallback = () => fallbackAnalysis(input.text, input.date, input.photoFeatures, input.photoHour);
  if (!llm) return fallback();
  try {
    const text = await llm.generateJson({
      system: SYSTEM_PROMPT,
      images: input.photos,
      text: userBlock(input.text, input.date, input.song, input.photoHour),
      schema: RESPONSE_SCHEMA,
    });
    if (!text) return fallback();
    const parsed = DayAnalysisSchema.safeParse(parseModelJson(text));
    if (!parsed.success) {
      console.error('analyzeDay: ответ модели не по схеме', parsed.error.issues.slice(0, 3));
      return fallback();
    }
    return normalize(parsed.data, input);
  } catch (e) {
    console.error('analyzeDay: модель недоступна, запасной анализ', e instanceof Error ? e.message : e);
    return fallback();
  }
}
