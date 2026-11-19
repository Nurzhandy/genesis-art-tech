// Импрессионизм (мазки и свет Моне): мазки по фото, цвет подтянут к палитре дня (B3).
import { clamp, ctx2d, featherMask, hexRgb, lumOf, makeCanvas, nearest, rgba, sampleZone } from '../draw';
import { mulberry32, noise2, range } from '../rng';
import type { PhotoTime } from '../timeline';
import type { RenderCtx, TechniqueRenderer } from '../types';

interface Strokes { n: number; x: Float32Array; y: Float32Array; a: Float32Array; len: Float32Array; w: Float32Array; col: string[] }

const SAMPLE = 0.5;   // выборка пикселей в половинном разрешении

export function createImpressionist(): TechniqueRenderer {
  let strokes: Strokes[] = [];
  let layer: HTMLCanvasElement;
  let mask: HTMLCanvasElement;
  let tmp: HTMLCanvasElement;
  let layerSlot = -1;     // какой «слот» (кадр в круге) сейчас на слое
  let drawn = 0;
  let lights: { x: number; y: number; r: number; s: number }[] = [];

  function buildStrokes(rc: RenderCtx, i: number): Strokes {
    const { zone, style } = rc;
    const p = rc.photos[i];
    const sw = Math.round(zone.w * SAMPLE), sh = Math.round(zone.h * SAMPLE);
    const data = sampleZone(p.img, p.w, p.h, sw, sh).data;
    const pal = style.palette.accents.map(hexRgb);
    const rand = mulberry32(style.seed * 31 + i);
    const energy = clamp((style.motion.jitter - 0.1) / 0.6);
    const n = Math.round(Math.min(5200, 3400 * (0.6 + style.composition.density)));
    const s: Strokes = { n, x: new Float32Array(n), y: new Float32Array(n), a: new Float32Array(n), len: new Float32Array(n), w: new Float32Array(n), col: new Array(n) };
    const lum = (x: number, y: number) => {
      const xi = Math.min(sw - 1, Math.max(0, x | 0)), yi = Math.min(sh - 1, Math.max(0, y | 0));
      const o = (yi * sw + xi) * 4;
      return lumOf(data[o], data[o + 1], data[o + 2]);
    };
    const order: { k: number; key: number }[] = [];
    for (let k = 0; k < n; k++) {
      const x = rand() * zone.w, y = rand() * zone.h;
      const sx = x * SAMPLE, sy = y * SAMPLE;
      const o = ((Math.min(sh - 1, sy | 0)) * sw + Math.min(sw - 1, sx | 0)) * 4;
      const rgb: [number, number, number] = [data[o], data[o + 1], data[o + 2]];
      const near = nearest(rgb, pal);
      const mix = 0.3;
      const c = rgb.map((v, j) => Math.round(v * (1 - mix) + near[j] * mix));
      const gx = lum(sx + 1.5, sy) - lum(sx - 1.5, sy);
      const gy = lum(sx, sy + 1.5) - lum(sx, sy - 1.5);
      const flow = noise2(x / 140, y / 140, style.seed) * Math.PI * 2;
      const angle = Math.hypot(gx, gy) > 0.04 ? Math.atan2(gy, gx) + Math.PI / 2 : flow;
      s.x[k] = x; s.y[k] = y; s.a[k] = angle;
      // Первые 35% — крупный подмалёвок, остальные — тонкие мазки поверх.
      const coarse = k < n * 0.35;
      s.len[k] = (8 + 30 * style.texture.brush * (1 - energy * 0.4)) * range(rand, 1.1, 1.9) * (coarse ? 1.7 : 1);
      s.w[k] = range(rand, 3, 7) * (coarse ? 3.4 : 1.7);
      s.col[k] = `rgba(${c[0]},${c[1]},${c[2]},${range(rand, 0.6, 0.9).toFixed(2)})`;
      order.push({ k, key: (k < n * 0.35 ? 0 : 1) + x / zone.w * 0.55 + y / zone.h * 0.15 + noise2(x / 300, y / 300, style.seed + 7) * 0.5 });
    }
    // Волна проявления: мазки ложатся слева направо с шумом.
    order.sort((a, b) => a.key - b.key);
    const re = (arr: Float32Array) => Float32Array.from(order.map((o) => arr[o.k]));
    return { n, x: re(s.x), y: re(s.y), a: re(s.a), len: re(s.len), w: re(s.w), col: order.map((o) => s.col[o.k]) };
  }

  function paint(g: CanvasRenderingContext2D, s: Strokes, from: number, to: number) {
    g.lineCap = 'round';
    for (let k = from; k < to; k++) {
      const dx = Math.cos(s.a[k]) * s.len[k] / 2, dy = Math.sin(s.a[k]) * s.len[k] / 2;
      g.strokeStyle = s.col[k];
      g.lineWidth = s.w[k];
      g.beginPath();
      g.moveTo(s.x[k] - dx, s.y[k] - dy);
      g.quadraticCurveTo(s.x[k] + dy * 0.15, s.y[k] - dx * 0.15, s.x[k] + dx, s.y[k] + dy);
      g.stroke();
    }
  }

  const slotOf = (pt: PhotoTime, n: number) => pt.cycle * n + pt.index;

  return {
    prepare(rc) {
      strokes = rc.photos.map((_, i) => buildStrokes(rc, i));
      layer = makeCanvas(rc.zone.w, rc.zone.h);
      tmp = makeCanvas(rc.zone.w, rc.zone.h);
      mask = featherMask(rc.zone.w, rc.zone.h, 70);
      const rand = mulberry32(rc.style.seed + 99);
      lights = Array.from({ length: 4 }, () => ({ x: rand(), y: rand(), r: range(rand, 180, 420), s: rand() * 10 }));
      layerSlot = -1; drawn = 0;
    },
    drawPhoto(rc, pt, { realtime }) {
      const n = rc.photos.length;
      const slot = slotOf(pt, n);
      const g = ctx2d(layer);
      const target = Math.floor(clamp(pt.local / 0.3) * strokes[pt.index].n);
      if (slot !== layerSlot || target < drawn) {
        // Новый кадр (или перемотка): под ним — полностью прописанный предыдущий кадр.
        if (slot !== layerSlot + 1 || target < drawn) {
          g.fillStyle = rc.style.palette.paper;
          g.fillRect(0, 0, layer.width, layer.height);
          if (slot > 0) { const prev = strokes[pt.prevIndex]; paint(g, prev, 0, prev.n); }
        }
        layerSlot = slot; drawn = 0;
      }
      const upto = realtime ? Math.min(target, drawn + 2600) : target;
      if (upto > drawn) { paint(g, strokes[pt.index], drawn, upto); drawn = upto; }

      // Мягкий край и лёгкое «дыхание» слоя.
      const t = ctx2d(tmp);
      t.globalCompositeOperation = 'source-over';
      t.clearRect(0, 0, tmp.width, tmp.height);
      t.drawImage(layer, 0, 0);
      t.globalCompositeOperation = 'destination-in';
      t.drawImage(mask, 0, 0);
      const breath = Math.sin(pt.t * 0.6) * 2.5 * rc.style.motion.jitter;
      rc.ctx.drawImage(tmp, rc.zone.x + breath, rc.zone.y - breath * 0.5);
    },
    drawOverlay(rc, pt, alpha) {
      const g = rc.ctx;
      g.save();
      g.globalCompositeOperation = 'screen';
      const color = rc.style.palette.accents[0];
      const e = rc.energy(pt);
      for (const l of lights) {
        const x = rc.zone.x + rc.zone.w * (l.x + 0.08 * (noise2(pt.t * 0.05, l.s, 3) - 0.5));
        const y = rc.zone.y + rc.zone.h * (l.y + 0.08 * (noise2(l.s, pt.t * 0.05, 4) - 0.5));
        const r = l.r * (1 + 0.08 * e);
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, rgba(color, 0.22 * alpha));
        gr.addColorStop(1, rgba(color, 0));
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      g.restore();
    },
  };
}
