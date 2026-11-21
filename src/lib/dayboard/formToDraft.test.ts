import { describe, expect, it, vi } from 'vitest';
import { BoardSchema, type Board, type BoardItem } from '@/lib/board/board';
import { collectDay } from '@/lib/board/collect';
import { formItems, splitText, submitToDraft, type DraftDeps, type FormInput } from './formToDraft';

let n = 0;
const uid = () => `id${++n}`;
const blob = new Blob(['x'], { type: 'image/jpeg' });

function fakeDeps(start: BoardItem[] = []) {
  let board: Board = { v: 1, items: start };
  let up = 0;
  const createDay = vi.fn();
  const deps: DraftDeps & { createDay: typeof createDay } = {
    createDay,
    dayBoard: vi.fn(async () => ({ board, urls: Object.fromEntries(board.items.flatMap((i) => (i.kind === 'photo' ? [[i.path, `/u/${i.path}`]] : []))) })),
    saveDayBoard: vi.fn(async (_id: string, b: Board) => { board = BoardSchema.parse(b); }),
    dayBoardUpload: vi.fn(async (_id: string, ext = 'jpg') => ({ path: `d/_dayboard/x/${++up}.${ext}`, token: 't', signedUrl: '/s' })),
    uploadFile: vi.fn(async () => undefined),
    prepare: vi.fn(async (items: BoardItem[]) => ({ photoFeatures: items.filter((i) => i.kind === 'photo').slice(0, 5).map((_, index) => ({ index, width: 10, height: 10, palette: ['#000000'], brightness: 0.5, warmth: 0, saturation: 0.5 })), music: null })),
    assembleDay: vi.fn(async (id: string) => ({ id } as never)),
  };
  return { deps, get board() { return board; } };
}

const input = (over: Partial<FormInput> = {}): FormInput => ({
  date: '2026-11-21', place: 'Павлодар', text: 'Гуляли у реки', photos: [{ blob, ratio: 1.3 }],
  song: { url: 'https://www.deezer.com/track/1', title: 'Autumn Leaves' }, feelings: ['уют'], voice: null, ...over,
});

describe('простая форма → доска черновика (C2)', () => {
  it('не создаёт новый день: заметка, фото, песня и настроение ложатся на доску того же черновика и он собирается', async () => {
    const f = fakeDeps();
    await submitToDraft('draft-1', input(), f.deps, uid);
    expect(f.deps.createDay).not.toHaveBeenCalled();
    expect(f.deps.assembleDay).toHaveBeenCalledWith('draft-1', expect.objectContaining({ date: '2026-11-21', place: 'Павлодар' }));
    const kinds = f.board.items.map((i) => i.kind).sort();
    expect(kinds).toEqual(['mood', 'note', 'photo', 'song']);
    const got = collectDay(f.board);
    expect(got.text).toContain('Гуляли у реки');
    expect(got.photoPaths).toHaveLength(1);
    expect(got.song).toMatchObject({ kind: 'link', url: 'https://www.deezer.com/track/1' });
    expect(got.feeling).toBe('уют');
  });

  it('то, что уже лежало на доске, остаётся и идёт первым', async () => {
    const old: BoardItem = { id: 'old', kind: 'note', x: 0, y: 0, rot: 0, text: 'Утром был туман', w: 220, color: '#f4efe6', font: 'hand' };
    const f = fakeDeps([old]);
    await submitToDraft('draft-1', input({ photos: [], song: null, feelings: [] }), f.deps, uid);
    expect(f.board.items[0]).toEqual(old);
    expect(collectDay(f.board).text.indexOf('Утром был туман')).toBeLessThan(collectDay(f.board).text.indexOf('Гуляли у реки'));
  });

  it('голосовое загружается и становится элементом voice', async () => {
    const f = fakeDeps();
    await submitToDraft('draft-1', input({ voice: { blob, ext: 'webm', sec: 42 } }), f.deps, uid);
    expect(f.deps.dayBoardUpload).toHaveBeenCalledWith('draft-1', 'webm');
    expect(f.board.items.find((i) => i.kind === 'voice')).toMatchObject({ sec: 42 });
  });

  it('длинный текст режется на заметки не длиннее 2000 символов', () => {
    const parts = splitText(`${'а'.repeat(1500)}\n\n${'б'.repeat(1500)}\n\n${'в'.repeat(4500)}`);
    expect(parts.every((p) => p.length <= 2000)).toBe(true);
    expect(parts.join('').replace(/\n/g, '').length).toBe(7500);
  });

  it('новое ложится ниже старого', () => {
    const old: BoardItem = { id: 'o', kind: 'photo', x: 50, y: 100, rot: 0, path: 'p', w: 200, ratio: 1, caption: undefined };
    const items = formItems([old], { text: 'день', photos: [], song: null, feelings: [], voice: null }, uid);
    expect(items[0].y).toBeGreaterThan(100 + 240);
    expect(items[0].x).toBe(50);
  });
});
