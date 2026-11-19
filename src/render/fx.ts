// Пост-обработка: плёночное зерно и виньетка (одинаковы для всего дневника, сила — из стиля).
import type { StyleParams } from '@/lib/types';
import { makeCanvas, ctx2d } from './draw';
import { mulberry32 } from './rng';

export function makeGrainTile(seed: number, size = 256): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const img = g.createImageData(size, size);
  const rand = mulberry32(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (rand() - 0.5) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function drawGrain(g: CanvasRenderingContext2D, tile: HTMLCanvasElement, W: number, H: number, style: StyleParams, frame: number) {
  if (style.texture.grain <= 0.02) return;
  g.save();
  g.globalCompositeOperation = 'overlay';
  g.globalAlpha = Math.min(0.55, 0.12 + style.texture.grain * 0.45);
  const rand = mulberry32(style.seed + frame);
  const ox = Math.floor(rand() * tile.width), oy = Math.floor(rand() * tile.height);
  g.translate(-ox, -oy);
  const pattern = g.createPattern(tile, 'repeat');
  if (pattern) { g.fillStyle = pattern; g.fillRect(0, 0, W + tile.width, H + tile.height); }
  g.restore();
}

export function drawVignette(g: CanvasRenderingContext2D, W: number, H: number, strength: number) {
  g.save();
  const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, `rgba(0,0,0,${strength})`);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  g.restore();
}
