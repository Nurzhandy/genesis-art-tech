// Утилиты рисования: холсты, вписывание фото, цвета.
import type { Zone } from './types';

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: false })!;

/** Источник для «cover»-вписывания фото в прямоугольник. */
export function coverSource(iw: number, ih: number, w: number, h: number) {
  const k = Math.max(w / iw, h / ih);
  const sw = w / k, sh = h / k;
  return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh };
}

export function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, iw: number, ih: number, r: Zone, zoom = 1) {
  const s = coverSource(iw, ih, r.w, r.h);
  const zw = s.sw / zoom, zh = s.sh / zoom;
  ctx.drawImage(img, s.sx + (s.sw - zw) / 2, s.sy + (s.sh - zh) / 2, zw, zh, r.x, r.y, r.w, r.h);
}

export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgba = (hex: string, a: number) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };

export function nearest(rgb: [number, number, number], palette: [number, number, number][]): [number, number, number] {
  let best = palette[0], bd = Infinity;
  for (const p of palette) {
    const d = (p[0] - rgb[0]) ** 2 + (p[1] - rgb[1]) ** 2 + (p[2] - rgb[2]) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export const lumOf = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Снимок фото в зоне (для выборки пикселей). */
export function sampleZone(img: CanvasImageSource, iw: number, ih: number, w: number, h: number): ImageData {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  drawCover(g, img, iw, ih, { x: 0, y: 0, w, h });
  return g.getImageData(0, 0, c.width, c.height);
}

/** Маска с мягкими краями: прямоугольник, края уходят в прозрачность. */
export function featherMask(w: number, h: number, feather: number): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-out';
  const edge = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(rx, ry, rw, rh);
  };
  edge(0, 0, 0, feather, 0, 0, w, feather);
  edge(0, h, 0, h - feather, 0, h - feather, w, feather);
  edge(0, 0, feather, 0, 0, 0, feather, h);
  edge(w, 0, w - feather, 0, w - feather, 0, feather, h);
  return c;
}
