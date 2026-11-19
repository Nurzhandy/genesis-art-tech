import { describe, expect, it } from 'vitest';
import { dayFolder, dayFiles } from './storage';

describe('dayFolder', () => {
  it('готовый день лежит в папке «дата-название»', () => {
    expect(dayFolder('d1', '2026-11-03', 'osenniy-park-i-kakao', 'x')).toBe('d1/2026-11-03-osenniy-park-i-kakao');
  });
  it('черновик без названия лежит во временной папке', () => {
    expect(dayFolder('d1', '2026-11-03', null, 'abc')).toBe('d1/_draft-abc');
  });
});

describe('dayFiles', () => {
  it('раскладывает файлы дня по стандартным путям папки', () => {
    const f = dayFiles('d1/2026-11-03-park');
    expect(f.photo(0, 'jpg')).toBe('d1/2026-11-03-park/photos/01.jpg');
    expect(f.thumb(1)).toBe('d1/2026-11-03-park/photos/thumb/02.jpg');
    expect(f.audio('mp3')).toBe('d1/2026-11-03-park/song.mp3');
    expect(f.poster).toBe('d1/2026-11-03-park/memory.png');
    expect(f.voice).toBe('d1/2026-11-03-park/voice.mp3');
    expect(f.json('analysis')).toBe('d1/2026-11-03-park/analysis.json');
    expect(f.text).toBe('d1/2026-11-03-park/text.md');
  });
});
