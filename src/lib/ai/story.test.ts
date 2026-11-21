import { describe, expect, it } from 'vitest';
import type { LlmLike, LlmRequest } from './analyzeDay';
import { cleanTranscript, StoryInput, storyToEntry } from './story';

const RAW = 'ну короче мы мы сегодня гуляли по набережной типа было холодно но солнце садилось и вот пахло жареными каштанами';

const llm = (out: unknown, onCall?: (r: LlmRequest) => void): LlmLike => ({
  generateJson: async (req) => { onCall?.(req); return out === null ? null : JSON.stringify(out); },
});

describe('рассказ → запись (cleanTranscript)', () => {
  it('убирает слова-паразиты и повторы, ставит заглавную и точку', () => {
    const t = cleanTranscript(RAW);
    expect(t.startsWith('Мы сегодня гуляли по набережной')).toBe(true);
    const words = t.toLocaleLowerCase('ru').split(/[^\p{L}]+/u);
    for (const f of ['ну', 'короче', 'типа', 'вот']) expect(words).not.toContain(f);
    expect(t).not.toMatch(/мы мы/);
    expect(t).toContain('пахло жареными каштанами');
    expect(t.endsWith('.')).toBe(true);
  });

  it('не трогает слова, внутри которых есть «ну» или «вот»', () => {
    expect(cleanTranscript('мы нашли воробья у самого поворота')).toBe('Мы нашли воробья у самого поворота.');
  });

  it('пустая речь — пустая строка', () => {
    expect(cleanTranscript('ну эээ короче')).toBe('');
  });
});

describe('storyToEntry', () => {
  const good = { transcript: RAW, entry: 'Гуляли по набережной. Было холодно, солнце садилось, пахло жареными каштанами.', place: 'Астана', song: 'Frank Sinatra — Autumn Leaves', details: ['жареными каштанами'] };

  it('с моделью: запись, город, песня и детали; запись голоса уходит модели как аудио', async () => {
    let sent: LlmRequest | undefined;
    const r = await storyToEntry({ audio: 'AAAA', mime: 'audio/webm;codecs=opus', transcript: RAW }, llm(good, (q) => { sent = q; }));
    expect(r).toMatchObject({ source: 'ai', place: 'Астана', song: 'Frank Sinatra — Autumn Leaves' });
    expect(r.entry).toContain('каштанами');
    expect(sent!.images).toEqual([{ base64: 'AAAA', mediaType: 'audio/webm' }]);
    expect(sent!.text).toContain('Черновая расшифровка');
    expect(sent!.system).toMatch(/Ничего не выдумывай/);
  });

  it('модель недоступна или ответила мусором → чистим расшифровку сами', async () => {
    const broken: LlmLike = { generateJson: async () => { throw new Error('503'); } };
    expect((await storyToEntry({ transcript: RAW }, broken)).source).toBe('local');
    expect((await storyToEntry({ transcript: RAW }, llm({ nope: 1 }))).source).toBe('local');
    expect((await storyToEntry({ transcript: RAW }, null)).entry).toContain('набережной');
  });

  it('в записи нет слов: модель повторила вводную — ошибка, а не выдуманная запись', async () => {
    const echo = { transcript: 'Это запись рассказа о дне.', entry: 'Это запись рассказа о дне.', place: null, song: null, details: [] };
    await expect(storyToEntry({ audio: 'AAAA', mime: 'audio/wav' }, llm(echo))).rejects.toThrow('не слышно слов');
    await expect(storyToEntry({ audio: 'AAAA', mime: 'audio/wav' }, llm({ ...echo, transcript: '' }))).rejects.toThrow('не слышно слов');
    // Браузер слова расслышал — берём их.
    expect((await storyToEntry({ audio: 'AAAA', mime: 'audio/wav', transcript: RAW }, llm(echo))).transcript).toContain('набережной');
  });

  it('только аудио и модель недоступна → понятная ошибка', async () => {
    await expect(storyToEntry({ audio: 'AAAA', mime: 'audio/mp4' }, null)).rejects.toThrow('GEMINI_API_KEY');
  });

  it('вход: нужна запись или расшифровка, тип только audio/*', () => {
    expect(StoryInput.safeParse({}).success).toBe(false);
    expect(StoryInput.safeParse({ transcript: '   ' }).success).toBe(false);
    expect(StoryInput.safeParse({ audio: 'AAAA', mime: 'image/png' }).success).toBe(false);
    expect(StoryInput.safeParse({ audio: 'AAAA', mime: 'audio/mp4' }).success).toBe(true);
  });
});
