import { describe, expect, it } from 'vitest';
import { DecorSchema } from '@/lib/decor/decor';
import type { Board, BoardItem } from './board';
import { BoardSchema } from './board';
import { boardSong, collectDay, decorColor, EMPTY_BOARD_ERROR, readingOrder } from './collect';

const note = (id: string, x: number, y: number, text: string): BoardItem => ({ id, kind: 'note', x, y, rot: 0, text, w: 200, color: '#fff3b0', font: 'hand' });
const photo = (id: string, x: number, y: number, caption?: string): BoardItem => ({ id, kind: 'photo', x, y, rot: 0, path: `d/_dayboard/x/${id}.jpg`, w: 200, ratio: 1, ...(caption ? { caption } : {}) });
const board = (...items: BoardItem[]): Board => ({ v: 1, items });

describe('collectDay', () => {
  it('заметки читаются сверху вниз, на одной строке — слева направо', () => {
    const d = collectDay(board(note('c', 0, 500, 'третья'), note('b', 400, 10, 'вторая'), note('a', 0, 0, 'первая')));
    expect(d.text).toBe('первая\n\nвторая\n\nтретья');
  });

  it('берёт первые 5 фото по порядку, подписи добавляются к тексту', () => {
    const photos = Array.from({ length: 7 }, (_, i) => photo(`p${i}`, i * 300, 0, i === 0 ? 'море' : undefined));
    const d = collectDay(board(...photos.reverse()));
    expect(d.photoPaths).toEqual([0, 1, 2, 3, 4].map((i) => `d/_dayboard/x/p${i}.jpg`));
    expect(d.text).toBe('море');
  });

  it('первая песня — песня дня, исполнитель и название делятся по тире', () => {
    const song = (id: string, y: number, title: string): BoardItem => ({ id, kind: 'song', x: 0, y, rot: 0, url: 'https://open.spotify.com/track/abc', title, size: 160 });
    const d = collectDay(board(song('s2', 400, 'Другая'), song('s1', 0, 'Земфира — Искала')));
    expect(d.song).toMatchObject({ kind: 'link', provider: 'spotify', artist: 'Земфира', title: 'Искала' });
  });

  it('без песни — песни нет, без капли — чувства нет', () => {
    const d = collectDay(board(note('a', 0, 0, 'просто мысли')));
    expect(d.song).toEqual({ kind: 'none' });
    expect(d.feeling).toBeUndefined();
    expect(d.decor).toBeNull();
  });

  it('капля настроения даёт чувства через запятую', () => {
    const d = collectDay(board(note('a', 0, 0, 'день'), { id: 'm', kind: 'mood', x: 0, y: 0, rot: 0, feelings: ['радость', 'уют', 'радость'], size: 120 }));
    expect(d.feeling).toBe('радость, уют');
  });

  it('пустая доска — понятная ошибка', () => {
    expect(() => collectDay(board())).toThrow(EMPTY_BOARD_ERROR);
    expect(() => collectDay(board(note('a', 0, 0, '   ')))).toThrow(EMPTY_BOARD_ERROR);
  });

  it('рисунки и стикеры вписываются в холст постера и проходят схему украшений', () => {
    const long = Array.from({ length: 1200 }, (_, i) => [i * 10, Math.sin(i) * 300]).flat();
    const d = collectDay(board(
      note('a', 0, 0, 'день'),
      { id: 's', kind: 'stroke', x: 0, y: 0, rot: 0, points: long, width: 8, color: '#c8892b', glow: true },
      { id: 't', kind: 'sticker', x: -5000, y: 3000, rot: 10, shape: 'heart', size: 120, color: '#111111' },
    ));
    expect(DecorSchema.safeParse(d.decor).success).toBe(true);
    const stroke = d.decor!.items.find((i) => i.kind === 'stroke')!;
    expect(stroke.kind === 'stroke' && stroke.points.length).toBeLessThanOrEqual(800);
    expect(stroke).toMatchObject({ glow: true });
    expect(d.decor!.items.find((i) => i.kind === 'sticker')).toMatchObject({ color: 'ink', shape: 'heart' });
  });
});

describe('мелочи', () => {
  it('порядок чтения и цвета', () => {
    expect(readingOrder([{ x: 5, y: 100 }, { x: 0, y: 0 }]).map((p) => p.x)).toEqual([0, 5]);
    expect(decorColor('#000000', 0)).toBe('ink');
    expect(decorColor('#ffffff', 0)).toBe('paper');
    expect(decorColor('#c8892b', 1)).toBe('a1');
    expect(boardSong(undefined)).toEqual({ kind: 'none' });
  });

  it('капля настроения проходит схему доски', () => {
    expect(BoardSchema.safeParse(board({ id: 'm', kind: 'mood', x: 0, y: 0, rot: 0, feelings: ['уют'], size: 100 })).success).toBe(true);
    expect(BoardSchema.safeParse(board({ id: 'm', kind: 'mood', x: 0, y: 0, rot: 0, feelings: [], size: 100 } as never)).success).toBe(false);
  });
});
