import { describe, expect, it } from 'vitest';
import type { MusicFeatures } from '@/lib/types';
import { mergeMusic, resolveSong } from './resolve';

const audioF: MusicFeatures = { source: 'audio', bpm: 120, energy: 0.7, mode: 'unknown', brightness: 0.4 };
const deezerF: MusicFeatures = { source: 'deezer', bpm: 100, energy: 0.5, mode: 'unknown', year: 1957 };
const guess = { bpm: 76, energy: 0.3, mode: 'major' as const, genre: 'jazz', year: 1957 };

describe('mergeMusic', () => {
  it('ничего нет → нейтральные значения', () => {
    expect(mergeMusic(null, null, null)).toEqual({ source: 'llm', bpm: 90, energy: 0.5, mode: 'unknown' });
  });
  it('анализ файла важнее Deezer', () => {
    const m = mergeMusic(audioF, deezerF, guess);
    expect(m.source).toBe('audio');
    expect(m.bpm).toBe(120);
  });
  it('лад и жанр берутся из оценки модели, если их нет в источнике', () => {
    const m = mergeMusic(audioF, null, guess);
    expect(m.mode).toBe('major');
    expect(m.genre).toBe('jazz');
    expect(m.year).toBe(1957);
  });
  it('bpm=0 у Deezer означает «нет данных» → берём оценку модели', () => {
    const m = mergeMusic(null, { ...deezerF, bpm: 0 }, guess);
    expect(m.bpm).toBe(76);
  });
  it('только оценка модели → source llm', () => {
    expect(mergeMusic(null, null, guess)).toMatchObject({ source: 'llm', bpm: 76, energy: 0.3, mode: 'major', genre: 'jazz', year: 1957 });
  });
});

const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

describe('resolveSong', () => {
  it('Spotify: имя из oEmbed, bpm и превью из Deezer', async () => {
    const fetcher = async (url: string) => {
      if (url.includes('open.spotify.com/oembed')) return json({ title: 'Autumn Leaves', author_name: 'Frank Sinatra' });
      if (url.includes('api.deezer.com/search')) return json({ data: [{ id: 42, title: 'Autumn Leaves', artist: { name: 'Frank Sinatra' } }] });
      if (url.includes('api.deezer.com/track/42')) return json({ id: 42, bpm: 76.5, preview: 'https://cdn/x.mp3', release_date: '1957-06-01', album: { cover_medium: 'https://cdn/c.jpg' } });
      throw new Error('unexpected ' + url);
    };
    const r = await resolveSong('https://open.spotify.com/track/abc', fetcher);
    expect(r.song).toMatchObject({ kind: 'link', provider: 'spotify', title: 'Autumn Leaves', artist: 'Frank Sinatra', previewUrl: '/api/music/preview?id=42', year: 1957 });
    expect(r.music).toMatchObject({ source: 'deezer', bpm: 76.5, year: 1957 });
  });
  it('YouTube «Artist - Title» разбирается на исполнителя и название', async () => {
    const fetcher = async (url: string) => {
      if (url.includes('youtube.com/oembed')) return json({ title: 'Daft Punk - Something About Us (Official Video)', author_name: 'Daft Punk' });
      return json({ data: [] });
    };
    const r = await resolveSong('https://youtu.be/dQw4w9WgXcQ', fetcher);
    expect(r.song).toMatchObject({ artist: 'Daft Punk', title: 'Something About Us' });
    expect(r.music).toBeNull();
  });
  it('любые сбои сети → песня без данных, но без ошибки', async () => {
    const r = await resolveSong('https://open.spotify.com/track/abc', async () => { throw new Error('offline'); });
    expect(r.song).toMatchObject({ kind: 'link', provider: 'spotify' });
    expect(r.music).toBeNull();
  });
  it('мусор вместо ссылки → ошибка', async () => {
    await expect(resolveSong('не ссылка', async () => json({}))).rejects.toThrow();
  });
});

describe('mergeMusic: год', () => {
  it('год оригинала из оценки модели важнее года ремастера в Deezer', () => {
    expect(mergeMusic(null, { ...deezerF, year: 2002 }, guess).year).toBe(1957);
  });
});
