// Стопка полароидов (план 20.11, C6): порядок карточек и наклоны — чистые функции, чтобы проверить тестом.

/** Карточки по глубине: верхняя — `top`, дальше по кругу. */
export const stackOrder = (count: number, top: number): number[] =>
  Array.from({ length: count }, (_, depth) => (top + depth) % count);

/** Наклон карточки: стабильный для фото, от −6° до 6°, у соседних в разные стороны. */
export function tiltOf(index: number): number {
  const base = [-4, 3, -2, 5, -6, 2][index % 6];
  return index === 0 ? -1.5 : base;
}

/** Свайп: короткое движение — это клик, длинное влево/вправо листает. */
export function swipeStep(dx: number, threshold = 50): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold) return 0;
  return dx < 0 ? 1 : -1;
}

export const nextTop = (top: number, step: number, count: number) => ((top + step) % count + count) % count;
