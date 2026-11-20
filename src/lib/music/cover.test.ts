import { describe, expect, it } from 'vitest';
import { coverProxyUrl, isAllowedCoverUrl } from './cover';

describe('isAllowedCoverUrl', () => {
  it('пускает обложки Deezer, Spotify, YouTube и Apple', () => {
    for (const u of [
      'https://e-cdns-images.dzcdn.net/images/cover/abc/250x250-000000-80-0-0.jpg',
      'https://cdn-images.dzcdn.net/images/cover/abc/500x500.jpg',
      'https://i.scdn.co/image/ab67616d0000b273abc',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      'https://is1-ssl.mzstatic.com/image/thumb/Music/x/600x600bb.jpg',
    ]) expect(isAllowedCoverUrl(u)).toBe(true);
  });
  it('не пускает чужие хосты, http, внутренние адреса и мусор', () => {
    for (const u of [
      'http://e-cdns-images.dzcdn.net/images/cover/abc.jpg',
      'https://evil.com/dzcdn.net/x.jpg',
      'https://dzcdn.net.evil.com/x.jpg',
      'https://169.254.169.254/latest/meta-data',
      'https://localhost/x.jpg',
      'https://i.scdn.co@evil.com/x.jpg',
      'не ссылка',
      '',
    ]) expect(isAllowedCoverUrl(u)).toBe(false);
  });
});

describe('coverProxyUrl', () => {
  it('ведёт через наш прокси, чтобы холст не стал «грязным»', () => {
    expect(coverProxyUrl('https://i.scdn.co/image/a b')).toBe('/api/music/cover?url=https%3A%2F%2Fi.scdn.co%2Fimage%2Fa%20b');
  });
});
