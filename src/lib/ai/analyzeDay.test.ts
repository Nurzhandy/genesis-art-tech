import { describe, expect, it } from 'vitest';
import type { PhotoFeatures } from '@/lib/types';
import { analyzeDay, type ClaudeLike } from './analyzeDay';

const photo: PhotoFeatures = { index: 0, width: 10, height: 10, palette: ['#c8892b'], brightness: 0.6, warmth: 0.5, saturation: 0.5 };
const base = {
  text: 'Гуляли по парку, всё в жёлтых листьях, пили какао',
  date: '2026-10-18',
  photos: [{ base64: 'AAAA', mediaType: 'image/jpeg' as const }],
  photoFeatures: [photo],
  song: { kind: 'link' as const, url: 'https://open.spotify.com/track/x', provider: 'spotify' as const, title: 'Autumn Leaves', artist: 'Frank Sinatra' },
};

const fakeClient = (result: unknown, onCall?: (p: unknown) => void): ClaudeLike => ({
  messages: { parse: async (params: unknown) => { onCall?.(params); return result as never; } },
});

const good = {
  mood: { valence: 0.7, arousal: 0.2, tension: 0.1, nostalgia: 0.4 },
  moodWords: ['тёплый', 'уютный', 'зябкий'], season: 'autumn', timeOfDay: 'day', setting: 'nature', people: 'pair',
  sensory: ['запах какао'], photoScenes: [{ index: 0, subject: 'аллея', light: 'warm' }],
  title: 'Осенний парк и какао', caption: 'холодно, но тепло',
  songGuess: { bpm: 76, energy: 0.3, mode: 'major', genre: 'Jazz', year: 1957 },
};

describe('analyzeDay', () => {
  it('отказ модели → запасной анализ, день не падает', async () => {
    const a = await analyzeDay(base, { client: fakeClient({ stop_reason: 'refusal', parsed_output: null }) });
    expect(a.source).toBe('fallback');
  });
  it('ошибка сети → запасной анализ', async () => {
    const client: ClaudeLike = { messages: { parse: async () => { throw new Error('ECONNRESET'); } } };
    expect((await analyzeDay(base, { client })).source).toBe('fallback');
  });
  it('нет клиента (нет ключа) → запасной анализ', async () => {
    expect((await analyzeDay(base, { client: null })).source).toBe('fallback');
  });
  it('успешный ответ → source claude, жанр в нижнем регистре', async () => {
    const a = await analyzeDay(base, { client: fakeClient({ stop_reason: 'end_turn', parsed_output: good }) });
    expect(a.source).toBe('claude');
    expect(a.title).toBe('Осенний парк и какао');
    expect(a.songGuess?.genre).toBe('jazz');
  });
  it('невалидное название от модели заменяется запасным', async () => {
    const a = await analyzeDay(base, { client: fakeClient({ stop_reason: 'end_turn', parsed_output: { ...good, title: 'Парк' } }) });
    expect(a.source).toBe('claude');
    expect(a.title.split(' ').length).toBeGreaterThanOrEqual(3);
  });
  it('числа вне шкал прижимаются к границам', async () => {
    const a = await analyzeDay(base, { client: fakeClient({ stop_reason: 'end_turn', parsed_output: { ...good, mood: { valence: 3, arousal: -1, tension: 2, nostalgia: 0.5 } } }) });
    expect(a.mood).toEqual({ valence: 1, arousal: 0, tension: 1, nostalgia: 0.5 });
  });
  it('отправляет фото картинками и текст дня одним сообщением', async () => {
    let sent: { messages: { content: { type: string }[] }[] } | undefined;
    await analyzeDay(base, { client: fakeClient({ stop_reason: 'end_turn', parsed_output: good }, (p) => { sent = p as typeof sent; }) });
    const types = sent!.messages[0].content.map((c) => c.type);
    expect(types).toEqual(['image', 'text']);
  });
});
