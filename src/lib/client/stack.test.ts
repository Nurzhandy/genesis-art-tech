import { describe, expect, it } from 'vitest';
import { nextTop, stackOrder, swipeStep, tiltOf } from './stack';

describe('стопка фото (C6)', () => {
  it('верхняя карточка первой, остальные по кругу', () => {
    expect(stackOrder(4, 0)).toEqual([0, 1, 2, 3]);
    expect(stackOrder(4, 2)).toEqual([2, 3, 0, 1]);
  });
  it('листание по кругу в обе стороны', () => {
    expect(nextTop(3, 1, 4)).toBe(0);
    expect(nextTop(0, -1, 4)).toBe(3);
  });
  it('свайп влево — следующая, вправо — предыдущая, короткий — клик', () => {
    expect(swipeStep(-80)).toBe(1);
    expect(swipeStep(90)).toBe(-1);
    expect(swipeStep(20)).toBe(0);
  });
  it('наклоны в пределах ±6° и стабильны', () => {
    for (let i = 0; i < 5; i++) {
      expect(Math.abs(tiltOf(i))).toBeLessThanOrEqual(6);
      expect(tiltOf(i)).toBe(tiltOf(i));
    }
  });
});
