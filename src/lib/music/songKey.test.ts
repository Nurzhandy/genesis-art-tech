import { describe, expect, it } from 'vitest';
import { sameSong, songKey, songKeys } from './songKey';

describe('ключ песни (A6)', () => {
  it('одна песня из разных сервисов и файлом — один ключ', () => {
    const a = songKey({ kind: 'link', url: 'https://open.spotify.com/track/abc', provider: 'spotify', artist: 'Frank Sinatra', title: 'Autumn Leaves' });
    const b = songKey({ kind: 'link', url: 'https://www.deezer.com/track/1', provider: 'deezer', artist: 'frank sinatra', title: 'Autumn Leaves (Remastered 1998)' });
    const c = songKey({ kind: 'file', path: 'x.mp3', artist: 'Frank Sinatra', title: 'Autumn leaves' });
    expect(a).toBe('frank sinatra — autumn leaves');
    expect(b).toBe(a);
    expect(c).toBe(a);
  });
  it('ё и е не различаем', () => {
    expect(songKey({ kind: 'file', path: 'x', title: 'Ёлка' })).toBe(songKey({ kind: 'file', path: 'x', title: 'елка' }));
  });
  it('без названия — сервис и id трека из ссылки', () => {
    expect(songKey({ kind: 'link', url: 'https://youtu.be/dQw4w9WgXcQ', provider: 'youtube' })).toBe('youtube:dQw4w9WgXcQ');
  });
  it('день с названием и день только со ссылкой на тот же трек находят друг друга', () => {
    const full = { kind: 'link' as const, url: 'https://www.deezer.com/track/3231839', provider: 'deezer' as const, artist: 'Frank Sinatra', title: 'Autumn Leaves' };
    const bare = { kind: 'link' as const, url: 'https://www.deezer.com/track/3231839', provider: 'deezer' as const };
    expect(songKeys(full)).toEqual(['frank sinatra — autumn leaves', 'deezer:3231839']);
    expect(sameSong(bare, songKeys(full))).toBe(true);
    expect(sameSong(full, songKeys(bare))).toBe(true);
    expect(sameSong(bare, ['frank sinatra — fly me to the moon'])).toBe(false);
  });
  it('ничего не известно → null', () => {
    expect(songKey({ kind: 'link', url: 'https://example.com/x', provider: 'other' })).toBeNull();
    expect(songKey({ kind: 'file', path: 'x.mp3' })).toBeNull();
  });
});
