import { describe, expect, it } from 'vitest';
import { attachUrls, rowToDay, type DayRow } from './db';

const row: DayRow = {
  id: 'id1', diary_id: 'd1', date: '2026-11-03', title: 'Осенний парк и какао', slug: 'osenniy-park-i-kakao',
  text: 'текст', photos: [{ path: 'p/01.jpg', thumbPath: 'p/thumb/01.jpg', features: { index: 0, width: 1, height: 1, palette: ['#000000'], brightness: 0, warmth: 0, saturation: 0 } }],
  song: { kind: 'file', path: 'p/song.mp3' }, music: null, analysis: null, style: null,
  voice: { path: 'p/voice.mp3', preset: { voice: 'nova', speed: 1, instructions: '', because: '' } },
  poster_path: 'p/memory.png', status: 'ready', error: null, created_at: '2026-11-03T10:00:00Z',
};

describe('rowToDay', () => {
  it('переводит строку БД в DayRecord', () => {
    const d = rowToDay(row);
    expect(d.diaryId).toBe('d1');
    expect(d.posterPath).toBe('p/memory.png');
    expect(d.createdAt).toBe('2026-11-03T10:00:00Z');
  });
});

describe('attachUrls', () => {
  it('подставляет signed URLs для фото, превью, постера, голоса и своего аудиофайла', () => {
    const urls = { 'p/01.jpg': 'U1', 'p/thumb/01.jpg': 'U2', 'p/memory.png': 'U3', 'p/voice.mp3': 'U4', 'p/song.mp3': 'U5' };
    const d = attachUrls(rowToDay(row), urls);
    expect(d.photos[0].url).toBe('U1');
    expect(d.photos[0].thumbUrl).toBe('U2');
    expect(d.posterUrl).toBe('U3');
    expect(d.voice?.url).toBe('U4');
    expect(d.songUrl).toBe('U5');
  });
  it('для ссылки с превью Deezer отдаёт адрес нашего прокси', () => {
    const d = attachUrls(rowToDay({ ...row, song: { kind: 'link', url: 'https://x.y', provider: 'deezer', previewUrl: '/api/music/preview?id=3' } }), {});
    expect(d.songUrl).toBe('/api/music/preview?id=3');
  });
});
