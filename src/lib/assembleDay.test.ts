import { describe, expect, it } from 'vitest';
import type { DayRecord } from './types';
import type { Board } from './board/board';
import { assembleDay, type AssembleDeps } from './assembleDay';
import type { DayRow } from './db';
import type { GenerateBody } from './validation';

const ID = '11111111-2222-3333-4444-555555555555';
const day = (o: Partial<DayRecord> = {}): DayRecord => ({
  id: ID, diaryId: 'diary', date: '2026-11-21', title: null, slug: null, text: '', photos: [], song: { kind: 'none' },
  music: null, analysis: null, style: null, voice: null, posterPath: null, status: 'draft', error: null, createdAt: '', ...o,
});
const feat = { index: 7, width: 10, height: 10, palette: ['#c8892b'], brightness: 0.5, warmth: 0.2, saturation: 0.4 };
const photoItem = (id: string, x: number) => ({ id, kind: 'photo' as const, x, y: 0, rot: 0, path: `diary/_dayboard/${ID}/${id}.jpg`, w: 200, ratio: 1 });

function fake(d: DayRecord, board: Board, limit = false) {
  const log = { copies: [] as [string, string][], removed: [] as string[], patch: null as Partial<DayRow> | null, gen: null as GenerateBody | null };
  const deps: AssembleDeps = {
    load: async () => ({ day: d, board }),
    updateDay: async (_id, p) => { log.patch = p; return d; },
    copyFile: async (a, b) => { log.copies.push([a, b]); },
    removeFiles: async (p) => { log.removed.push(...p); },
    generate: async (_id, b) => { log.gen = b; return { ...d, status: 'ready' }; },
    limitReached: async () => limit,
  };
  return { deps, log };
}
const owner = () => undefined;

describe('assembleDay', () => {
  it('доска → поля дня, фото в слоты черновика, признаки фото по порядку', async () => {
    const board: Board = { v: 1, items: [
      { id: 'n', kind: 'note', x: 0, y: 0, rot: 0, text: 'Гуляли у моря', w: 200, color: '#fff3b0', font: 'hand' },
      photoItem('b', 500), photoItem('a', 100),
      { id: 'm', kind: 'mood', x: 0, y: 300, rot: 0, feelings: ['радость'], size: 100 },
    ] };
    const { deps, log } = fake(day(), board);
    const res = await assembleDay(ID, { photoFeatures: [feat, feat], music: null, place: 'Алматы' }, deps, owner);
    expect(res.status).toBe('ready');
    expect(log.patch).toMatchObject({ text: 'Гуляли у моря', feeling: 'радость', song: { kind: 'none' }, place: 'Алматы', status: 'draft' });
    expect(log.copies[0]).toEqual([`diary/_dayboard/${ID}/a.jpg`, `diary/_draft-${ID}/photos/01.jpg`]);
    expect(log.copies[1]).toEqual([`diary/_dayboard/${ID}/a.jpg`, `diary/_draft-${ID}/photos/thumb/01.jpg`]);
    expect(log.gen?.photoFeatures.map((f) => f.index)).toEqual([0, 1]);
  });

  it('день из одних слов: без фото и песни', async () => {
    const { deps, log } = fake(day(), { v: 1, items: [{ id: 'n', kind: 'note', x: 0, y: 0, rot: 0, text: 'идея', w: 200, color: '#fff3b0', font: 'hand' }] });
    await assembleDay(ID, { photoFeatures: [], music: null }, deps, owner);
    expect(log.copies).toEqual([]);
    expect(log.gen?.photoFeatures).toEqual([]);
  });

  it('голосовое с доски: расшифровка — текст дня, запись — голос дня', async () => {
    const path = `diary/_dayboard/${ID}/v.webm`;
    const { deps, log } = fake(day(), { v: 1, items: [{ id: 'v', kind: 'voice', x: 0, y: 0, rot: 0, path, sec: 12, peaks: [0.2, 0.8], transcript: 'сегодня был хороший день', w: 300 }] });
    await assembleDay(ID, { photoFeatures: [], music: null }, deps, owner);
    expect(log.patch).toMatchObject({ text: 'сегодня был хороший день', voice: { path, preset: { voice: 'own' } } });
  });

  it('без голосового старая озвучка сбрасывается', async () => {
    const { deps, log } = fake(day({ voice: { path: 'diary/x/voice.mp3', preset: { voice: 'alloy', speed: 1, instructions: '', because: '' } } }),
      { v: 1, items: [{ id: 'n', kind: 'note', x: 0, y: 0, rot: 0, text: 'идея', w: 200, color: '#fff3b0', font: 'hand' }] });
    await assembleDay(ID, { photoFeatures: [], music: null }, deps, owner);
    expect(log.patch?.voice).toBeNull();
  });

  it('пустая доска — 400 с понятным текстом, ничего не трогаем', async () => {
    const { deps, log } = fake(day(), { v: 1, items: [] });
    await expect(assembleDay(ID, { photoFeatures: [], music: null }, deps, owner)).rejects.toMatchObject({ status: 400 });
    expect(log.patch).toBeNull();
  });

  it('число признаков должно совпадать с числом фото', async () => {
    const { deps } = fake(day(), { v: 1, items: [photoItem('a', 0)] });
    await expect(assembleDay(ID, { photoFeatures: [], music: null }, deps, owner)).rejects.toMatchObject({ status: 400 });
  });

  it('пересборка убирает файлы прошлой сборки, но не фото доски', async () => {
    const ready = day({ status: 'ready', slug: 'more', posterPath: 'diary/2026-11-21-more/memory.jpg',
      photos: [{ path: 'diary/2026-11-21-more/photos/01.jpg', thumbPath: 'diary/2026-11-21-more/photos/thumb/01.jpg', features: feat }] });
    const { deps, log } = fake(ready, { v: 1, items: [photoItem('a', 0)] });
    await assembleDay(ID, { photoFeatures: [feat], music: null }, deps, owner);
    expect(log.removed).toContain('diary/2026-11-21-more/memory.jpg');
    expect(log.removed).toContain('diary/2026-11-21-more/photos/01.jpg');
    expect(log.removed.some((p) => p.includes('_dayboard'))).toBe(false);
    expect(log.patch).toMatchObject({ poster_path: null, status: 'draft' });
  });

  it('лимит исчерпан — 429 до того, как что-то удалено', async () => {
    const { deps, log } = fake(day({ status: 'ready' }), { v: 1, items: [photoItem('a', 0)] }, true);
    await expect(assembleDay(ID, { photoFeatures: [feat], music: null }, deps, owner)).rejects.toMatchObject({ status: 429 });
    expect(log.removed).toEqual([]);
  });

  it('пока день собирается — 409; чужой — ошибка владельца', async () => {
    const { deps } = fake(day({ status: 'generating' }), { v: 1, items: [photoItem('a', 0)] });
    await expect(assembleDay(ID, { photoFeatures: [feat], music: null }, deps, owner)).rejects.toMatchObject({ status: 409 });
    const f2 = fake(day(), { v: 1, items: [photoItem('a', 0)] });
    await expect(assembleDay(ID, { photoFeatures: [feat], music: null }, f2.deps, () => { throw new Error('не владелец'); })).rejects.toThrow('не владелец');
  });
});
