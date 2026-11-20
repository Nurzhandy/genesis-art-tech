import { describe, expect, it } from 'vitest';
import { exportName, pickVideoType } from './exportDay';

describe('экспорт дня (C1, C2)', () => {
  it('MP4, если браузер умеет, иначе WebM', () => {
    expect(pickVideoType((t) => t.startsWith('video/mp4'))).toEqual({ mime: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4' });
    expect(pickVideoType((t) => t === 'video/webm;codecs=vp8,opus')).toEqual({ mime: 'video/webm;codecs=vp8,opus', ext: 'webm' });
    expect(pickVideoType(() => false)).toBeNull();
  });
  it('имя файла из даты и названия без запрещённых символов', () => {
    expect(exportName({ date: '2026-10-18', title: 'Осенний парк и какао' }, 'обои', 'jpg')).toBe('2026-10-18 Осенний парк и какао — обои.jpg');
    expect(exportName({ date: '2026-10-18', title: 'Дождь / «кофе»?' }, 'видео 15 с', 'mp4')).toBe('2026-10-18 Дождь кофе — видео 15 с.mp4');
    expect(exportName({ date: '2026-10-18', title: null }, 'обои', 'jpg')).toBe('2026-10-18 день — обои.jpg');
  });
});
