import { describe, expect, it } from 'vitest';
import { GenerateBody, NewDayInput, UploadRequest } from './validation';

const ok = {
  date: '2026-11-03',
  text: 'Гуляли по парку, всё в жёлтых листьях',
  photoCount: 3,
  song: { kind: 'link', url: 'https://open.spotify.com/track/abc', provider: 'spotify' },
};

describe('NewDayInput', () => {
  it('принимает нормальный день', () => {
    expect(NewDayInput.safeParse(ok).success).toBe(true);
  });
  it('отклоняет пустой текст', () => {
    expect(NewDayInput.safeParse({ ...ok, text: '   ' }).success).toBe(false);
  });
  it('отклоняет текст длиннее 5000 символов', () => {
    expect(NewDayInput.safeParse({ ...ok, text: 'а'.repeat(5001) }).success).toBe(false);
  });
  it('фото и песня необязательны: день можно записать одними словами', () => {
    expect(NewDayInput.safeParse({ ...ok, photoCount: 0, song: { kind: 'none' } }).success).toBe(true);
    expect(NewDayInput.safeParse({ ...ok, photoCount: 6 }).success).toBe(false);
  });
  it('отклоняет ссылку на песню, которая не URL', () => {
    expect(NewDayInput.safeParse({ ...ok, song: { kind: 'link', url: 'not a url', provider: 'other' } }).success).toBe(false);
  });
  it('отклоняет дату не в формате yyyy-mm-dd', () => {
    expect(NewDayInput.safeParse({ ...ok, date: '03.11.2026' }).success).toBe(false);
  });
  it('принимает песню файлом без пути (путь назначит сервер)', () => {
    expect(NewDayInput.safeParse({ ...ok, song: { kind: 'file', title: 'Моя песня' } }).success).toBe(true);
  });
});

describe('UploadRequest', () => {
  it('принимает фото, превью, аудио и постер с допустимыми расширениями', () => {
    const r = UploadRequest.safeParse({ files: [
      { kind: 'photo', index: 0, ext: 'jpg' }, { kind: 'thumb', index: 0, ext: 'jpg' },
      { kind: 'audio', ext: 'mp3' }, { kind: 'poster', ext: 'jpg' },
    ] });
    expect(r.success).toBe(true);
  });
  it('отклоняет неизвестное расширение', () => {
    expect(UploadRequest.safeParse({ files: [{ kind: 'photo', index: 0, ext: 'exe' }] }).success).toBe(false);
  });
  it('отклоняет фото без индекса или с индексом больше 4', () => {
    expect(UploadRequest.safeParse({ files: [{ kind: 'photo', ext: 'jpg' }] }).success).toBe(false);
    expect(UploadRequest.safeParse({ files: [{ kind: 'photo', index: 5, ext: 'jpg' }] }).success).toBe(false);
  });
});

describe('GenerateBody', () => {
  it('принимает признаки фото и пустую музыку', () => {
    const r = GenerateBody.safeParse({
      photoFeatures: [{ index: 0, width: 10, height: 10, palette: ['#ffffff'], brightness: 0.5, warmth: 0, saturation: 0 }],
      music: null,
    });
    expect(r.success).toBe(true);
  });
  it('принимает музыку из Deezer с bpm=0 («нет данных»)', () => {
    const r = GenerateBody.safeParse({
      photoFeatures: [{ index: 0, width: 10, height: 10, palette: ['#ffffff'], brightness: 0.5, warmth: 0, saturation: 0 }],
      music: { source: 'deezer', bpm: 0, energy: 0.5, mode: 'unknown', year: 2002 },
    });
    expect(r.success).toBe(true);
  });
  it('отклоняет теплоту вне -1..1', () => {
    const r = GenerateBody.safeParse({
      photoFeatures: [{ index: 0, width: 10, height: 10, palette: ['#ffffff'], brightness: 0.5, warmth: 3, saturation: 0 }],
      music: null,
    });
    expect(r.success).toBe(false);
  });
});
