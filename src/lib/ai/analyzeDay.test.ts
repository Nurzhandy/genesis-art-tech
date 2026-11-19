import { describe, expect, it } from 'vitest';
import type { PhotoFeatures } from '@/lib/types';
import { analyzeDay, type LlmLike, type LlmRequest } from './analyzeDay';
import { toGeminiRequest } from './gemini';

const photo: PhotoFeatures = { index: 0, width: 10, height: 10, palette: ['#c8892b'], brightness: 0.6, warmth: 0.5, saturation: 0.5 };
const base = {
  text: 'Гуляли по парку, всё в жёлтых листьях, пили какао',
  date: '2026-10-18',
  photos: [{ base64: 'AAAA', mediaType: 'image/jpeg' as const }],
  photoFeatures: [photo],
  song: { kind: 'link' as const, url: 'https://open.spotify.com/track/x', provider: 'spotify' as const, title: 'Autumn Leaves', artist: 'Frank Sinatra' },
};

const good = {
  mood: { valence: 0.7, arousal: 0.2, tension: 0.1, nostalgia: 0.4 },
  moodWords: ['тёплый', 'уютный', 'зябкий'], season: 'autumn', timeOfDay: 'day', setting: 'nature', people: 'pair',
  sensory: ['запах какао'], photoScenes: [{ index: 0, subject: 'аллея', light: 'warm' }],
  title: 'Осенний парк и какао', caption: 'холодно, но тепло',
  songGuess: { bpm: 76, energy: 0.3, mode: 'major', genre: 'Jazz', year: 1957 },
};

const llm = (out: string | null, onCall?: (r: LlmRequest) => void): LlmLike => ({
  generateJson: async (req) => { onCall?.(req); return out; },
});

describe('analyzeDay', () => {
  it('ответ заблокирован моделью → запасной анализ, день не падает', async () => {
    expect((await analyzeDay(base, { llm: llm(null) })).source).toBe('fallback');
  });
  it('ошибка сети → запасной анализ', async () => {
    const failing: LlmLike = { generateJson: async () => { throw new Error('ECONNRESET'); } };
    expect((await analyzeDay(base, { llm: failing })).source).toBe('fallback');
  });
  it('нет клиента (нет ключа) → запасной анализ', async () => {
    expect((await analyzeDay(base, { llm: null })).source).toBe('fallback');
  });
  it('битый JSON → запасной анализ', async () => {
    expect((await analyzeDay(base, { llm: llm('{"mood": ') })).source).toBe('fallback');
  });
  it('JSON не по схеме → запасной анализ', async () => {
    expect((await analyzeDay(base, { llm: llm(JSON.stringify({ title: 'Только название' })) })).source).toBe('fallback');
  });
  it('успешный ответ → source ai, жанр в нижнем регистре', async () => {
    const a = await analyzeDay(base, { llm: llm(JSON.stringify(good)) });
    expect(a.source).toBe('ai');
    expect(a.title).toBe('Осенний парк и какао');
    expect(a.songGuess?.genre).toBe('jazz');
  });
  it('JSON в markdown-ограде тоже разбирается', async () => {
    expect((await analyzeDay(base, { llm: llm('```json\n' + JSON.stringify(good) + '\n```') })).source).toBe('ai');
  });
  it('невалидное название от модели заменяется запасным', async () => {
    const a = await analyzeDay(base, { llm: llm(JSON.stringify({ ...good, title: 'Парк' })) });
    expect(a.source).toBe('ai');
    expect(a.title.split(' ').length).toBeGreaterThanOrEqual(3);
  });
  it('числа вне шкал прижимаются к границам', async () => {
    const a = await analyzeDay(base, { llm: llm(JSON.stringify({ ...good, mood: { valence: 3, arousal: -1, tension: 2, nostalgia: 0.5 } })) });
    expect(a.mood).toEqual({ valence: 1, arousal: 0, tension: 1, nostalgia: 0.5 });
  });
  it('отправляет фото, текст дня и JSON-схему ответа', async () => {
    let sent: LlmRequest | undefined;
    await analyzeDay(base, { llm: llm(JSON.stringify(good), (r) => { sent = r; }) });
    expect(sent!.images).toHaveLength(1);
    expect(sent!.text).toContain('Гуляли по парку');
    expect(sent!.text).toContain('Frank Sinatra');
    expect(sent!.schema).toMatchObject({ type: 'object' });
  });
});

describe('toGeminiRequest', () => {
  it('фото идут картинками перед текстом, ответ — JSON по схеме', () => {
    const r = toGeminiRequest({ system: 'S', images: [{ base64: 'AAAA', mediaType: 'image/jpeg' }], text: 'T', schema: { type: 'object' } }, 'gemini-x');
    expect(r.model).toBe('gemini-x');
    expect(r.contents[0].parts).toEqual([{ inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } }, { text: 'T' }]);
    expect(r.config).toMatchObject({ systemInstruction: 'S', responseMimeType: 'application/json', responseJsonSchema: { type: 'object' } });
  });
});
