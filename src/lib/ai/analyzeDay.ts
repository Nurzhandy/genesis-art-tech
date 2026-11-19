// Один вызов Claude: текст + фото + песня → DayAnalysis. Любой сбой → запасной анализ (A3).
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { DayAnalysis, PhotoFeatures, SongRef } from '@/lib/types';
import { validateTitle } from '@/lib/title/validateTitle';
import { fallbackAnalysis } from './fallback';
import { SYSTEM_PROMPT, userBlock } from './prompts';
import { DayAnalysisSchema, type DayAnalysisRaw } from './schemas';

export interface AnalyzeInput {
  text: string;
  date: string;
  photos: { base64: string; mediaType: 'image/jpeg' }[];
  photoFeatures: PhotoFeatures[];
  song: SongRef;
}

/** Минимальный интерфейс клиента — чтобы тест мог подставить свой. */
export interface ClaudeLike {
  messages: { parse: (params: never) => Promise<{ stop_reason: string | null; parsed_output: unknown }> };
}

let defaultClient: ClaudeLike | null | undefined;
function getClient(): ClaudeLike | null {
  if (defaultClient !== undefined) return defaultClient;
  defaultClient = process.env.ANTHROPIC_API_KEY
    ? (new Anthropic({ timeout: 45_000, maxRetries: 1 }) as unknown as ClaudeLike)
    : null;
  return defaultClient;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));

export function normalize(raw: DayAnalysisRaw, input: AnalyzeInput): DayAnalysis {
  const fb = () => fallbackAnalysis(input.text, input.date, input.photoFeatures);
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
    sensory: raw.sensory.slice(0, 6),
    photoScenes: raw.photoScenes.filter((s) => s.index >= 0 && s.index < Math.max(1, input.photos.length)),
    title: title.ok ? title.title : fb().title,
    caption: raw.caption.trim().slice(0, 60) || fb().caption,
    songGuess: raw.songGuess
      ? {
          bpm: clamp(raw.songGuess.bpm, 50, 200),
          energy: clamp(raw.songGuess.energy, 0, 1),
          mode: raw.songGuess.mode,
          genre: raw.songGuess.genre.toLowerCase().trim(),
          year: Math.round(clamp(raw.songGuess.year, 1900, 2100)),
        }
      : null,
    source: 'claude',
  };
}

export async function analyzeDay(input: AnalyzeInput, deps: { client?: ClaudeLike | null } = {}): Promise<DayAnalysis> {
  const client = deps.client === undefined ? getClient() : deps.client;
  const fallback = () => fallbackAnalysis(input.text, input.date, input.photoFeatures);
  if (!client) return fallback();
  try {
    const params = {
      model: process.env.CLAUDE_MODEL || 'claude-opus-5-5',
      max_tokens: 4000,
      output_config: { effort: 'medium', format: zodOutputFormat(DayAnalysisSchema) },
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          ...input.photos.map((p) => ({ type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.base64 } })),
          { type: 'text', text: userBlock(input.text, input.date, input.song) },
        ],
      }],
    };
    const res = await client.messages.parse(params as never);
    if (res.stop_reason === 'refusal' || !res.parsed_output) return fallback();
    return normalize(res.parsed_output as DayAnalysisRaw, input);
  } catch (e) {
    console.error('analyzeDay: Claude недоступен, запасной анализ', e instanceof Error ? e.message : e);
    return fallback();
  }
}
