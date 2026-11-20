import { describe, expect, it } from 'vitest';
import { BoardSchema, normalizeBoard, placeMissingDays } from './board';

const D1 = '11111111-2222-3333-4444-555555555555', D2 = '21111111-2222-3333-4444-555555555555';

describe('свободная доска', () => {
  it('пустая или битая доска → пустая', () => {
    expect(normalizeBoard(undefined)).toEqual({ v: 1, items: [] });
    expect(normalizeBoard({ v: 2 })).toEqual({ v: 1, items: [] });
  });
  it('любые цвета, заметки, фото, стрелки, рамки', () => {
    const b = { v: 1, items: [
      { id: 'n', kind: 'note', x: 0, y: 0, rot: 0, text: 'инсайт', w: 240, color: '#ff00aa', font: 'hand' },
      { id: 'a', kind: 'arrow', x: 0, y: 0, rot: 0, x2: 100, y2: 50, color: '#000000', width: 3 },
      { id: 'f', kind: 'frame', x: -50, y: -50, rot: 0, w: 800, h: 600, title: 'Алматы', color: '#2f6f73' },
    ] };
    expect(BoardSchema.safeParse(b).success).toBe(true);
    expect(BoardSchema.safeParse({ v: 1, items: [{ ...b.items[0], color: 'red' }] }).success).toBe(false);
  });
  it('новые дни ложатся справа, уже лежащие не двигаются', () => {
    const b = placeMissingDays({ v: 1, items: [{ id: 'd', kind: 'day', dayId: D1, x: 500, y: 10, rot: 0, w: 260 }] }, [D1, D2]);
    expect(b.items).toHaveLength(2);
    expect(b.items[0]).toMatchObject({ dayId: D1, x: 500 });
    expect(b.items[1].x).toBeGreaterThan(760);
    expect(placeMissingDays(b, [D1, D2])).toBe(b);
  });
});
