// Слой украшений на холсте (спека 2026-11-20): после подписи и заметок, до зерна — поэтому он есть в постере,
// обоях, видео, книге и на странице подарка. Стикеры с «вырубкой» цвета бумаги, как настоящие наклейки.
import type { StyleParams } from '@/lib/types';
import { resolveColor, type Decor, type DecorItem, type StickerShape } from '@/lib/decor/decor';
import { SHAPES } from '@/lib/decor/shapes';
import type { Fonts } from './types';

export const STICKER_BASE = 150;   // размер стикера при scale = 1, px холста

const pathCache = new Map<string, Path2D>();
const path = (d: string) => {
  let p = pathCache.get(d);
  if (!p) { p = new Path2D(d); pathCache.set(d, p); }
  return p;
};

/** Стикер в точке (0,0) текущей системы координат, размер size. */
export function drawSticker(g: CanvasRenderingContext2D, shape: StickerShape, size: number, color: string, paper: string) {
  const k = size / 100;
  g.save();
  g.scale(k, k);
  g.translate(-50, -50);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // Вырубка: обводка цвета бумаги под всеми частями.
  g.shadowColor = 'rgba(0,0,0,0.22)';
  g.shadowBlur = 6 / k;
  g.shadowOffsetY = 2 / k;
  g.strokeStyle = paper;
  for (const part of SHAPES[shape]) {
    g.lineWidth = (part.w ?? 0) + 9;
    g.stroke(path(part.d));
  }
  g.shadowColor = 'transparent';
  for (const part of SHAPES[shape]) {
    const c = part.paper ? paper : color;
    g.globalAlpha = part.alpha ?? 1;
    if (part.mode === 'fill') { g.fillStyle = c; g.fill(path(part.d)); }
    else { g.strokeStyle = c; g.lineWidth = part.w ?? 4; g.stroke(path(part.d)); }
  }
  g.restore();
}

function drawStroke(g: CanvasRenderingContext2D, pts: number[], width: number, color: string) {
  if (pts.length < 2) return;
  g.strokeStyle = color;
  g.lineWidth = width * 2;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  if (pts.length === 2) g.lineTo(pts[0] + 0.1, pts[1]);
  // Сглаживание: кривые через середины соседних точек.
  for (let i = 2; i < pts.length - 2; i += 2) {
    g.quadraticCurveTo(pts[i], pts[i + 1], (pts[i] + pts[i + 2]) / 2, (pts[i + 1] + pts[i + 3]) / 2);
  }
  if (pts.length >= 4) g.lineTo(pts[pts.length - 2], pts[pts.length - 1]);
  g.stroke();
}

export function drawDecorItem(g: CanvasRenderingContext2D, it: DecorItem, palette: StyleParams['palette'], fonts: Fonts) {
  const color = resolveColor(it.color, palette);
  g.save();
  if (it.kind === 'sticker') {
    g.translate(it.x, it.y);
    g.rotate((it.rot * Math.PI) / 180);
    drawSticker(g, it.shape, STICKER_BASE * it.scale, color, palette.paper);
  } else if (it.kind === 'text') {
    g.translate(it.x, it.y);
    g.rotate((it.rot * Math.PI) / 180);
    g.font = `500 ${it.size}px ${fonts.hand}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(it.text, 0, 0);
  } else {
    drawStroke(g, it.points, it.width, color);
  }
  g.restore();
}

/** Весь слой. withText = false для обоев «без текста»: только стикеры и кисть. */
export function drawDecor(g: CanvasRenderingContext2D, decor: Decor | null | undefined, palette: StyleParams['palette'], fonts: Fonts, alpha = 1, withText = true) {
  if (!decor?.items.length || alpha <= 0) return;
  g.save();
  g.globalAlpha = alpha;
  for (const it of decor.items) if (withText || it.kind !== 'text') drawDecorItem(g, it, palette, fonts);
  g.restore();
}
