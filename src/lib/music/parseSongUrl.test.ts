import { describe, expect, it } from 'vitest';
import { parseSongUrl } from './parseSongUrl';

describe('parseSongUrl', () => {
  it('Spotify: трек и embed', () => {
    expect(parseSongUrl('https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp?si=x')).toMatchObject({
      provider: 'spotify', id: '3n3Ppam7vgaVa1iaRUc9Lp', embedUrl: 'https://open.spotify.com/embed/track/3n3Ppam7vgaVa1iaRUc9Lp',
    });
    expect(parseSongUrl('https://open.spotify.com/intl-ru/track/3n3Ppam7vgaVa1iaRUc9Lp')).toMatchObject({ provider: 'spotify', id: '3n3Ppam7vgaVa1iaRUc9Lp' });
  });
  it('YouTube: короткая, обычная и music-ссылка', () => {
    expect(parseSongUrl('https://youtu.be/dQw4w9WgXcQ')).toMatchObject({ provider: 'youtube', id: 'dQw4w9WgXcQ', embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' });
    expect(parseSongUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toMatchObject({ provider: 'youtube', id: 'dQw4w9WgXcQ' });
    expect(parseSongUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toMatchObject({ provider: 'youtube', id: 'dQw4w9WgXcQ' });
  });
  it('Яндекс Музыка, Deezer, Apple, SoundCloud', () => {
    expect(parseSongUrl('https://music.yandex.ru/album/1/track/2')).toMatchObject({ provider: 'yandex', id: '2' });
    expect(parseSongUrl('https://www.deezer.com/track/3135556')).toMatchObject({ provider: 'deezer', id: '3135556' });
    expect(parseSongUrl('https://www.deezer.com/en/track/3135556')).toMatchObject({ provider: 'deezer', id: '3135556' });
    expect(parseSongUrl('https://music.apple.com/kz/album/x/123?i=456')).toMatchObject({ provider: 'apple' });
    expect(parseSongUrl('https://soundcloud.com/artist/track')).toMatchObject({ provider: 'soundcloud' });
  });
  it('другой сайт — other, текст — null', () => {
    expect(parseSongUrl('https://example.com/song')).toMatchObject({ provider: 'other' });
    expect(parseSongUrl('просто текст')).toBeNull();
    expect(parseSongUrl('ftp://x.y/z')).toBeNull();
  });
});
