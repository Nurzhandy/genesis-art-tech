// Общие контракты между частями A и B.
// Меняем только по договорённости и отдельным коммитом `types: ...` (см. docs/plan/00-overview.md, раздел 3).

// ── Ввод ────────────────────────────────────────────────
export type SongProvider = 'spotify' | 'youtube' | 'yandex' | 'apple' | 'deezer' | 'soundcloud' | 'other';

export type SongRef =
  | { kind: 'link'; url: string; provider: SongProvider; title?: string; artist?: string;
      embedUrl?: string; previewUrl?: string; coverUrl?: string; year?: number }
  | { kind: 'file'; path: string; title?: string; artist?: string };

/** Считается в браузере (часть A) из сжатого фото. */
export interface PhotoFeatures {
  index: number;
  width: number; height: number;
  palette: string[];      // 5 hex по убыванию доли
  brightness: number;     // 0..1 (средняя яркость L*)
  warmth: number;         // -1 (холодно/синий) .. 1 (тепло/оранжевый)
  saturation: number;     // 0..1
}

export interface MusicFeatures {
  source: 'audio' | 'deezer' | 'llm';   // откуда взяли, по убыванию надёжности
  bpm: number;                          // 50..200
  energy: number;                       // 0..1
  mode: 'major' | 'minor' | 'unknown';
  brightness?: number;                  // 0..1 спектральный центроид, только source='audio'
  genre?: string;                       // латиницей, lower-case: 'jazz', 'electronic', ...
  year?: number;
}

// ── Анализ дня (выход модели или fallback) ──────────────
export interface Mood {
  valence: number;     // -1..1  (грусть ↔ радость)
  arousal: number;     //  0..1  (покой ↔ возбуждение)
  tension: number;     //  0..1  (расслабленность ↔ напряжение, дедлайн)
  nostalgia: number;   //  0..1
}

export interface DayAnalysis {
  mood: Mood;
  moodWords: string[];                 // 3–5 русских слов: «уютный», «зябкий»
  season: 'winter' | 'spring' | 'summer' | 'autumn' | 'unknown';
  timeOfDay: 'morning' | 'day' | 'evening' | 'night' | 'unknown';
  setting: 'nature' | 'city' | 'indoor' | 'water' | 'transport' | 'mixed';
  people: 'alone' | 'pair' | 'group' | 'unknown';
  sensory: string[];                   // детали из текста: «запах какао», «шуршание листьев»
  photoScenes: { index: number; subject: string; light: 'warm' | 'cool' | 'neutral' | 'low' | 'harsh' }[];
  title: string;                       // 3–7 слов, см. правила названий
  caption: string;                     // рукописная подпись, ≤ 60 символов
  songGuess: { bpm: number; energy: number; mode: 'major' | 'minor'; genre: string; year: number } | null;
  source: 'ai' | 'fallback';
}

// ── Визуальная система ──────────────────────────────────
export type Technique = 'impressionist' | 'geometric' | 'minimal' | 'film' | 'collage';

export interface MoodOverride { warmth: number; energy: number }   // -0.4..0.4 (ресерч R10)

export interface StyleInput {
  analysis: DayAnalysis;
  photos: PhotoFeatures[];
  music: MusicFeatures;
  date: string;          // ISO yyyy-mm-dd
  seed: number;          // стабильный, из dayId
  moodOverride?: MoodOverride | null;   // поправка человека «Не совсем так?»
}

export type AtmosphereKind = 'leaves' | 'snow' | 'rain' | 'mist' | 'dust' | 'lights' | 'none';
export type SongObjectKind = 'vinyl' | 'cassette' | 'cd' | 'stream';

export interface StyleReason { param: string; because: string }   // для панели «Почему так»

export interface StyleParams {
  version: 1;
  seed: number;
  techniques: { primary: Technique; secondary: Technique | null; mix: number /*0..1 доля secondary*/;
                scores: Record<Technique, number> };
  palette: { bg: string; paper: string; ink: string; accents: string[] /*3–5*/ };
  texture: { grain: number; paper: number; brush: number };              // 0..1
  composition: { density: number; negativeSpace: number; asymmetry: number;
                 photoFrame: 'soft' | 'hard' | 'torn' | 'none' };       // 0..1
  motion: { bpm: number; beatsPerPhoto: 2 | 4 | 8; jitter: number; easing: 'soft' | 'sharp' };
  typography: { titleWeight: 400 | 600 | 700; captionTilt: number /*градусы, -6..6*/ };
  durationSec: number;   // 20..45
  atmosphere: { kind: AtmosphereKind; amount: number /*0..1*/ };   // ресерч R3
  // Песня как предмет (ресерч S2). Необязательно: у дней, собранных раньше, его нет.
  songObject?: { kind: SongObjectKind; year: number | null; revPerSec: number };
  reasons: StyleReason[];
}

export interface VoicePreset { voice: string; speed: number; instructions: string; because: string }

// ── Хранение ────────────────────────────────────────────
export type DayStatus = 'draft' | 'generating' | 'ready' | 'error';

export interface DayRecord {
  id: string; diaryId: string;
  date: string; title: string | null; slug: string | null;
  text: string;
  photos: { path: string; thumbPath: string; url?: string; thumbUrl?: string; features: PhotoFeatures }[];
  song: SongRef; songUrl?: string;      // songUrl: signed URL файла/превью для <audio>
  music: MusicFeatures | null;
  analysis: DayAnalysis | null;
  style: StyleParams | null;
  voice: { path: string; url?: string; preset: VoicePreset } | null;
  posterPath: string | null; posterUrl?: string;
  status: DayStatus; error: string | null;
  createdAt: string;
  dayNumber?: number;                   // порядковый номер готового дня в дневнике (для шапки)
  moodOverride?: MoodOverride | null;   // ресерч R10, null = как решила система (колонка mood_override — часть A)
}
