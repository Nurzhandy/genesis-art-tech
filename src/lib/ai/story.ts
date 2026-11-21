// «Рассказать день»: устный рассказ (запись голоса и/или расшифровка браузера) → запись в дневник.
// Нет времени писать — человек говорит пару минут как другу, а модель бережно переписывает это
// в текст от первого лица: его словами, без выдумок, без слов-паразитов.
import { z } from 'zod';
import { parseModelJson, type LlmLike } from './analyzeDay';

export const MAX_STORY_AUDIO_BYTES = 8 * 1024 * 1024;   // ~3 минуты речи в opus/aac с запасом

export const StoryInput = z.object({
  audio: z.string().max(Math.ceil((MAX_STORY_AUDIO_BYTES * 4) / 3) + 8).optional(),   // base64
  mime: z.string().regex(/^audio\/[\w.+-]+(;.*)?$/).max(80).optional(),
  transcript: z.string().max(12_000).optional(),
}).refine((v) => !!v.audio || !!v.transcript?.trim(), { message: 'Нужна запись голоса или расшифровка' });
export type StoryInput = z.infer<typeof StoryInput>;

export const StoryResultSchema = z.object({
  transcript: z.string().describe('дословная расшифровка рассказа'),
  entry: z.string().describe('запись в дневник от первого лица, 60–260 слов'),
  place: z.string().nullable().describe('город, если назван; иначе null'),
  song: z.string().nullable().describe('«Исполнитель — Название», если в рассказе названа песня; иначе null'),
  details: z.array(z.string()).describe('2–5 конкретных деталей дня дословно из рассказа'),
});
export type StoryResult = z.infer<typeof StoryResultSchema> & { source: 'ai' | 'local' };

const SCHEMA = z.toJSONSchema(StoryResultSchema, { target: 'draft-7' }) as object;

export const STORY_PROMPT = `Ты — бережный редактор личного дневника. Человек не успел написать о дне и рассказал о нём
голосом, как другу. Твоя задача — превратить устный рассказ в запись в его дневнике.

Правила:
- Пиши от первого лица, его словами и интонацией: сохраняй любимые выражения, шутки, порядок событий.
- Сохрани все конкретные детали: места, людей, погоду, свет, запахи, звуки, еду, песню, мелочи.
- Убери слова-паразиты («ну», «короче», «типа», «как бы», «эээ»), повторы, оговорки и обращения к записи.
- Ничего не выдумывай и не добавляй выводов, советов, морали или оценки состояния человека.
- Простые предложения, абзацы по смыслу, 60–260 слов. Без заголовка, без даты, без кавычек вокруг текста.
- Если рассказ очень короткий — запись тоже короткая, не растягивай.
- Язык записи — язык рассказа.

Также верни дословную расшифровку (transcript), город (place), если он назван, песню (song), если она названа,
и 2–5 деталей дня дословно из рассказа (details).`;

import { cleanTranscript } from './cleanTranscript';
export { cleanTranscript };

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const AUDIO_INTRO = 'Это запись рассказа о дне.';
/** В записи без слов (тишина, музыка) модель повторяет нашу же вводную фразу вместо расшифровки. */
const isEcho = (s: string) => s.toLowerCase().replace(/[.!…\s]+$/, '') === AUDIO_INTRO.toLowerCase().replace(/\.$/, '');
export const NO_WORDS_ERROR = 'В записи не слышно слов — запишите ещё раз, поближе к микрофону';

export async function storyToEntry(input: StoryInput, llm: LlmLike | null): Promise<StoryResult> {
  const transcript = clean(input.transcript);
  const local = (): StoryResult | null => {
    const entry = cleanTranscript(transcript);
    return entry ? { transcript, entry, place: null, song: null, details: [], source: 'local' } : null;
  };

  if (llm) {
    try {
      const out = await llm.generateJson({
        system: STORY_PROMPT,
        images: input.audio && input.mime ? [{ base64: input.audio, mediaType: input.mime.split(';')[0] }] : [],
        text: input.audio
          ? `${AUDIO_INTRO}${transcript ? `\n\nЧерновая расшифровка браузера (может содержать ошибки, сверяйся с записью):\n${transcript}` : ''}`
          : `Расшифровка рассказа о дне:\n${transcript}`,
        schema: SCHEMA,
      });
      const parsed = out ? StoryResultSchema.safeParse(parseModelJson(out)) : null;
      if (parsed?.success && clean(parsed.data.entry)) {
        const d = parsed.data;
        const said = isEcho(clean(d.transcript)) ? '' : clean(d.transcript);
        // Ни модель, ни браузер не услышали слов: запись дня из ничего была бы выдумкой.
        if (!said && !transcript) throw new Error(NO_WORDS_ERROR);
        return {
          transcript: said || transcript,
          entry: d.entry.trim().slice(0, 5000),
          place: clean(d.place) || null,
          song: clean(d.song) || null,
          details: d.details.map(clean).filter(Boolean).slice(0, 5),
          source: 'ai',
        };
      }
    } catch (e) {
      if (e instanceof Error && e.message === NO_WORDS_ERROR) throw e;
      console.error('story: модель недоступна, чистим расшифровку сами', e instanceof Error ? e.message : e);
    }
  }
  const fallback = local();
  if (fallback) return fallback;
  if (!llm && input.audio) throw new Error('Голосовое разбирает AI, а его ключ (GEMINI_API_KEY) на этом компьютере не подключён. На сайте это работает; здесь расскажите голосом в Chrome с микрофоном или напишите текстом.');
  throw new Error('Не получилось разобрать рассказ: запишите его ещё раз или напишите текстом');
}
