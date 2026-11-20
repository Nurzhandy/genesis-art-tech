import { describe, expect, it } from 'vitest';
import { isSealed, revealable, sealDateError, sealedView, serverToday } from './capsule';
import { newShareId, publicDay, SHARE_ID, sharedCopy, sharedOrNull } from './share';
import type { DayRecord } from './types';

const DIARY = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const day = (o: Partial<DayRecord> = {}): DayRecord => ({
  id: '11111111-2222-3333-4444-555555555555', diaryId: DIARY, date: '2026-10-18', title: 'Осенний парк и какао', slug: 'osenniy-park',
  text: 'Гуляли по парку', photos: [{ path: `${DIARY}/x/photos/01.jpg`, thumbPath: `${DIARY}/x/photos/thumb/01.jpg`, url: 'U', thumbUrl: 'T', features: { index: 0, width: 1, height: 1, palette: ['#000000'], brightness: 0, warmth: 0, saturation: 0 } }],
  song: { kind: 'file', path: `${DIARY}/x/song.mp3`, title: 'Моя' }, songUrl: 'S',
  music: null, analysis: null, style: null, voice: { path: `${DIARY}/x/voice.mp3`, url: 'V', preset: { voice: 'nova', speed: 1, instructions: '', because: '' } },
  posterPath: `${DIARY}/x/memory.jpg`, posterUrl: 'P', status: 'ready', error: null, createdAt: 'x',
  place: 'Астана', moodOverride: { warmth: 0.2, energy: 0 }, shareId: 'abcdefghij', ...o,
});

describe('ссылка-подарок (A4)', () => {
  it('id ссылки — 10 символов без похожих букв', () => {
    const ids = new Set(Array.from({ length: 50 }, newShareId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(SHARE_ID);
  });

  it('гость не получает ни ключа дневника, ни id дня, ни путей в хранилище', () => {
    const json = JSON.stringify(publicDay(day()));
    expect(json).not.toContain(DIARY);
    expect(json).not.toContain('11111111-2222');
    expect(json).not.toContain('Астана');
    const p = publicDay(day());
    expect(p.photos[0].url).toBe('U');
    expect(p.posterUrl).toBe('P');
    expect(p.songUrl).toBe('S');
    expect(p.voice?.url).toBe('V');
  });

  it('отозванная или чужая ссылка → нет дня', () => {
    expect(sharedOrNull(day({ shareId: null }), 'abcdefghij', '2026-11-20')).toBeNull();
    expect(sharedOrNull(day(), 'zzzzzzzzzz', '2026-11-20')).toBeNull();
    expect(sharedOrNull(null, 'abcdefghij', '2026-11-20')).toBeNull();
    expect(sharedOrNull(day({ status: 'generating' }), 'abcdefghij', '2026-11-20')).toBeNull();
    expect(sharedOrNull(day(), 'abcdefghij', '2026-11-20')?.title).toBe('Осенний парк и какао');
  });

  it('запечатанную капсулу по ссылке не открыть', () => {
    expect(sharedOrNull(day({ sealedUntil: '2027-11-19' }), 'abcdefghij', '2026-11-20')).toBeNull();
  });
});

describe('копии файлов для гостя (A4)', () => {
  it('подписанные ссылки гостя ведут в папку подарка, где нет id дневника', () => {
    const folder = `${DIARY}/2026-10-18-osenniy-park`;
    const d = day({
      photos: [{ path: `${folder}/photos/01.jpg`, thumbPath: `${folder}/photos/thumb/01.jpg`, features: day().photos[0].features }],
      song: { kind: 'file', path: `${folder}/song.mp3` }, posterPath: `${folder}/memory.jpg`,
      voice: { path: `${folder}/voice.mp3`, preset: { voice: 'nova', speed: 1, instructions: '', because: '' } },
    });
    const { pairs, day: copy } = sharedCopy(d, 'QWMVJAtYGg');
    expect(pairs).toContainEqual([`${folder}/photos/01.jpg`, '_shared/QWMVJAtYGg/photos/01.jpg']);
    expect(pairs).toContainEqual([`${folder}/memory.jpg`, '_shared/QWMVJAtYGg/memory.jpg']);
    expect(pairs).toHaveLength(5);
    const paths = JSON.stringify([copy.photos, copy.posterPath, copy.voice, copy.song]);
    expect(paths).not.toContain(DIARY);
    expect(copy.posterPath).toBe('_shared/QWMVJAtYGg/memory.jpg');
  });
});

describe('капсула времени (A5)', () => {
  it('до даты запечатан, в день открытия уже нет', () => {
    expect(isSealed({ sealedUntil: '2027-11-19' }, '2026-11-20')).toBe(true);
    expect(isSealed({ sealedUntil: '2027-11-19' }, '2027-11-19')).toBe(false);
    expect(isSealed({ sealedUntil: null }, '2026-11-20')).toBe(false);
  });

  it('запечатанный день не отдаёт текст, фото, песню, стиль и озвучку', () => {
    const v = sealedView(day({ sealedUntil: '2027-11-19' }));
    expect(v).toMatchObject({ sealed: true, title: 'Осенний парк и какао', date: '2026-10-18', sealedUntil: '2027-11-19', text: '', photos: [], style: null, voice: null, posterPath: null });
    expect(JSON.stringify(v)).not.toContain('Гуляли');
    expect(JSON.stringify(v)).not.toContain('song.mp3');
  });

  it('после даты отдаёт всё', () => {
    const d = day({ sealedUntil: '2026-11-01' });
    expect(revealable(d, '2026-11-20')).toBe(d);
    expect(revealable(day({ sealedUntil: '2027-01-01' }), '2026-11-20').text).toBe('');
  });

  it('дата капсулы только в будущем и не дальше 10 лет', () => {
    expect(sealDateError('2027-11-19', '2026-11-20')).toBeNull();
    expect(sealDateError('2026-11-20', '2026-11-20')).toMatch(/будущей/);
    expect(sealDateError('2040-01-01', '2026-11-20')).toMatch(/10 лет/);
    expect(sealDateError('2027-02-31x', '2026-11-20')).toMatch(/Неверная/);
  });

  it('сегодня считается по Астане', () => {
    expect(serverToday(new Date('2026-11-20T20:30:00Z'))).toBe('2026-11-21');
    expect(serverToday(new Date('2026-11-20T10:00:00Z'))).toBe('2026-11-20');
  });
});
