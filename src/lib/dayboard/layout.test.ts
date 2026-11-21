import { describe, expect, it } from 'vitest';
import { assemblyPicks, boardBox, fitInto, hasMaterial, itemBox, readingOrder, type AnyItem } from './layout';

const note = (id: string, x: number, y: number, text = 'день'): AnyItem => ({ id, kind: 'note', x, y, rot: 0, text, w: 200, color: '#f4efe6', font: 'hand' });
const photo = (id: string, x: number, y: number): AnyItem => ({ id, kind: 'photo', x, y, rot: 0, path: `p/${id}.jpg`, w: 200, ratio: 1.5 });
const song = (id: string, x: number, y: number): AnyItem => ({ id, kind: 'song', x, y, rot: 0, url: `https://x.y/${id}`, title: id, size: 160 });

describe('layout доски дня', () => {
  it('порядок чтения: сверху вниз, при равных y слева направо', () => {
    const r = readingOrder([note('c', 0, 300), note('b', 400, 10), note('a', 10, 10)]);
    expect(r.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('рамки: штрих по точкам, фото с подписью, новые виды по size', () => {
    expect(itemBox({ id: 's', kind: 'stroke', x: 0, y: 0, rot: 0, points: [10, 20, 50, 5], width: 4, color: '#000000' })).toEqual({ x: 10, y: 5, w: 40, h: 15 });
    expect(itemBox(photo('p', 0, 0))).toEqual({ x: 0, y: 0, w: 200, h: 340 });
    expect(itemBox({ id: 'm', kind: 'mood', x: 5, y: 6, feelings: ['уют'], size: 90 })).toEqual({ x: 5, y: 6, w: 90, h: 90 });
  });

  it('общая рамка и вписывание по центру', () => {
    const box = boardBox([note('a', 0, 0), note('b', 300, 210)])!;
    expect(box).toEqual({ x: 0, y: 0, w: 500, h: 300 });
    const f = fitInto(box, 1000, 600, 0);
    expect(f.s).toBeCloseTo(1.2);
    expect(boardBox([])).toBeNull();
  });

  it('пустая доска и доска из одних стикеров не собираются', () => {
    expect(hasMaterial([])).toBe(false);
    expect(hasMaterial([note('a', 0, 0, '   ')])).toBe(false);
    expect(hasMaterial([{ id: 'k', kind: 'sticker', x: 0, y: 0, rot: 0, shape: 'star', size: 80, color: '#000000' } as AnyItem])).toBe(false);
    expect(hasMaterial([song('s', 0, 0)])).toBe(true);
  });

  it('в сборку идут первые 5 фото и первая песня по порядку чтения', () => {
    const items = [song('late', 0, 900), song('first', 50, 0), ...[0, 1, 2, 3, 4, 5].map((i) => photo(`f${i}`, i * 10, 100 + i))];
    const p = assemblyPicks(items);
    expect(p.song?.id).toBe('first');
    expect(p.photos.map((x) => x.id)).toEqual(['f0', 'f1', 'f2', 'f3', 'f4']);
  });

  it('голосовое: есть из чего собрать день, рамка по ширине пузыря и расшифровке', () => {
    const v: AnyItem = { id: 'v', kind: 'voice', x: 0, y: 0, rot: 0, path: 'p/v.webm', sec: 4, peaks: [0.5], w: 340 };
    expect(hasMaterial([v])).toBe(true);
    expect(itemBox(v)).toEqual({ x: 0, y: 0, w: 340, h: 80 });
    expect(itemBox({ ...v, transcript: 'а'.repeat(64) }).h).toBe(80 + 30 + 2 * 26);
    expect(assemblyPicks([v]).voices.map((x) => x.id)).toEqual(['v']);
  });
});
