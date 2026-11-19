// Схема ответа модели (JSON по схеме). Границы чисел не задаём в схеме — прижимаем после.
import { z } from 'zod';

export const DayAnalysisSchema = z.object({
  mood: z.object({
    valence: z.number().describe('-1 (грусть) … 1 (радость)'),
    arousal: z.number().describe('0 (покой) … 1 (возбуждение, много событий)'),
    tension: z.number().describe('0 (расслабленность) … 1 (напряжение, дедлайн, тревога)'),
    nostalgia: z.number().describe('0 … 1, насколько день про память, детство, прошлое'),
  }),
  moodWords: z.array(z.string()).describe('3–5 русских прилагательных о настроении дня'),
  season: z.enum(['winter', 'spring', 'summer', 'autumn', 'unknown']),
  timeOfDay: z.enum(['morning', 'day', 'evening', 'night', 'unknown']),
  setting: z.enum(['nature', 'city', 'indoor', 'water', 'transport', 'mixed']),
  people: z.enum(['alone', 'pair', 'group', 'unknown']),
  sensory: z.array(z.string()).describe('конкретные детали из текста: запахи, звуки, свет, мелочи'),
  photoScenes: z.array(z.object({
    index: z.number().int(),
    subject: z.string(),
    light: z.enum(['warm', 'cool', 'neutral', 'low', 'harsh']),
  })),
  title: z.string().describe('название папки дня, 3–7 слов'),
  caption: z.string().describe('рукописная подпись, до 60 символов'),
  songGuess: z.object({
    bpm: z.number(),
    energy: z.number(),
    mode: z.enum(['major', 'minor']),
    genre: z.string(),
    year: z.number().int(),
  }).nullable(),
});

export type DayAnalysisRaw = z.infer<typeof DayAnalysisSchema>;
