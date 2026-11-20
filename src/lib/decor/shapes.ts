// Формы стикеров (спека 2026-11-20): свой нарисованный набор, а не эмодзи — одинаково на всех устройствах.
// Каждая форма — части в квадрате 100×100: залитые или обведённые. Общие для холста (Path2D) и панели (SVG).
import type { StickerShape } from './decor';

export interface ShapePart { d: string; mode: 'fill' | 'stroke'; w?: number; alpha?: number; paper?: boolean }

const petals = (n: number, r: number, pr: number) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2 - Math.PI / 2;
  const cx = 50 + Math.cos(a) * r, cy = 50 + Math.sin(a) * r;
  return `M${(cx - pr).toFixed(1)} ${cy.toFixed(1)} a${pr} ${pr} 0 1 0 ${pr * 2} 0 a${pr} ${pr} 0 1 0 ${-pr * 2} 0 Z`;
}).join(' ');

const rays = (n: number, r1: number, r2: number) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return `M${(50 + Math.cos(a) * r1).toFixed(1)} ${(50 + Math.sin(a) * r1).toFixed(1)} L${(50 + Math.cos(a) * r2).toFixed(1)} ${(50 + Math.sin(a) * r2).toFixed(1)}`;
}).join(' ');

const circle = (r: number) => `M${50 - r} 50 a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0 Z`;

export const SHAPES: Record<StickerShape, ShapePart[]> = {
  tape: [{ d: 'M6 32 L94 28 L96 36 L92 44 L96 52 L92 60 L96 66 L94 72 L6 70 L4 64 L8 56 L4 48 L8 40 L4 36 Z', mode: 'fill', alpha: 0.78 }],
  star: [{ d: 'M50 6 L61 38 L95 38 L67 58 L78 92 L50 71 L22 92 L33 58 L5 38 L39 38 Z', mode: 'fill' }],
  heart: [{ d: 'M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88 Z', mode: 'fill' }],
  leaf: [
    { d: 'M16 86 C8 50 30 12 88 10 C90 62 58 92 16 86 Z', mode: 'fill' },
    { d: 'M16 86 C36 64 54 42 72 26', mode: 'stroke', w: 4, paper: true },
  ],
  snowflake: [{ d: 'M50 6 V94 M12 28 L88 72 M12 72 L88 28 M50 20 L40 10 M50 20 L60 10 M50 80 L40 90 M50 80 L60 90', mode: 'stroke', w: 8 }],
  sun: [{ d: circle(20), mode: 'fill' }, { d: rays(10, 30, 44), mode: 'stroke', w: 7 }],
  flower: [{ d: petals(5, 22, 16), mode: 'fill' }, { d: circle(11), mode: 'fill', paper: true }],
  drop: [{ d: 'M50 6 C50 6 18 46 18 64 C18 82 32 94 50 94 C68 94 82 82 82 64 C82 46 50 6 50 6 Z', mode: 'fill' }],
  cloud: [{ d: 'M26 76 C12 76 6 64 10 54 C14 44 24 42 30 44 C32 30 44 22 56 24 C68 26 74 36 74 44 C86 42 96 52 94 64 C92 74 84 76 76 76 Z', mode: 'fill' }],
  cup: [
    { d: 'M16 40 H72 V64 C72 78 62 88 44 88 C26 88 16 78 16 64 Z', mode: 'fill' },
    { d: 'M72 46 C86 46 90 54 88 62 C86 70 78 70 72 68', mode: 'stroke', w: 7 },
    { d: 'M32 30 C28 22 36 18 32 8 M48 30 C44 22 52 18 48 8', mode: 'stroke', w: 5 },
  ],
  note: [
    { d: 'M24 76 a12 10 0 1 0 24 0 a12 10 0 1 0 -24 0 Z M58 66 a12 10 0 1 0 24 0 a12 10 0 1 0 -24 0 Z', mode: 'fill' },
    { d: 'M46 76 V18 L80 10 V66', mode: 'stroke', w: 7 },
  ],
  ticket: [
    { d: 'M6 26 H94 V42 A8 8 0 0 0 94 58 V74 H6 V58 A8 8 0 0 0 6 42 Z', mode: 'fill' },
    { d: 'M68 30 V36 M68 44 V50 M68 58 V64 M68 70 V72', mode: 'stroke', w: 3, paper: true },
  ],
  arrow: [{ d: 'M8 72 C28 40 58 30 86 34 M70 20 L88 34 L72 50', mode: 'stroke', w: 8 }],
  sparkle: [{ d: 'M50 4 C54 38 62 46 96 50 C62 54 54 62 50 96 C46 62 38 54 4 50 C38 46 46 38 50 4 Z', mode: 'fill' }],
  stamp: [
    { d: circle(40), mode: 'stroke', w: 6 },
    { d: circle(30), mode: 'stroke', w: 2.5 },
    { d: 'M50 34 L54 46 L66 46 L56 53 L60 65 L50 58 L40 65 L44 53 L34 46 L46 46 Z', mode: 'fill' },
  ],
  wave: [{ d: 'M6 44 C18 28 30 28 42 44 C54 60 66 60 78 44 C84 36 90 34 96 36 M6 66 C18 50 30 50 42 66 C54 82 66 82 78 66 C84 58 90 56 96 58', mode: 'stroke', w: 7 }],
};

export const SHAPE_NAMES: Record<StickerShape, string> = {
  tape: 'скотч', star: 'звезда', heart: 'сердце', leaf: 'лист', snowflake: 'снежинка', sun: 'солнце', flower: 'цветок',
  drop: 'капля', cloud: 'облако', cup: 'чашка', note: 'нота', ticket: 'билет', arrow: 'стрелка', sparkle: 'искра',
  stamp: 'печать', wave: 'волна',
};
