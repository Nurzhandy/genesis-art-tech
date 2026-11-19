// Постоянные элементы дневника: одинаковы у каждого дня (docs/plan/00-overview.md, раздел 5).
// Координаты зон — доли от ширины/высоты холста.

export const LAYOUT = {
  width: 1080,
  height: 1920,
  margin: 0.08,
  header: { y: 0.055, h: 0.04 },          // дата моно + номер дня
  title: { y: 0.105, h: 0.09 },           // название, Cormorant Garamond
  photo: { x: 0.08, y: 0.215, w: 0.84, h: 0.58 },
  caption: { y: 0.83, h: 0.07 },          // рукописная подпись, Caveat
  footer: { y: 0.935 },                   // имя дневника / ритм песни мелким моно
  fonts: {
    title: 'Cormorant Garamond',
    mono: 'JetBrains Mono',
    hand: 'Caveat',
  },
  sizes: { header: 26, title: 76, caption: 58, footer: 22 },
} as const;

export type Layout = typeof LAYOUT;
