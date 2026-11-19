// Геометрия (по мотивам Кандинского, свои фигуры): постеризованные окна по сетке, фигуры в ритм (B4).
import { hexToOklch } from '@/lib/style/color';
import { drawCover, hexRgb, lumOf, makeCanvas, rgba } from '../draw';
import { mulberry32, pick, range } from '../rng';
import type { RenderCtx, TechniqueRenderer, Zone } from '../types';

type ShapeKind = 'circle' | 'ring' | 'half' | 'line' | 'arc' | 'checker' | 'triangle';
interface Shape { kind: ShapeKind; x: number; y: number; s: number; rot: number; color: string; w: number }

const COLS = 6, ROWS = 10;

export function createGeometric(): TechniqueRenderer {
  let poster: HTMLCanvasElement[] = [];
  let windows: Zone[][] = [];
  let shapes: Shape[] = [];

  function posterize(rc: RenderCtx, i: number): HTMLCanvasElement {
    const { zone, style } = rc;
    const p = rc.photos[i];
    const c = makeCanvas(zone.w / 2, zone.h / 2);
    const g = c.getContext('2d', { willReadFrequently: true })!;
    drawCover(g, p.img, p.w, p.h, { x: 0, y: 0, w: c.width, h: c.height });
    const img = g.getImageData(0, 0, c.width, c.height);
    // Рампа из палитры от тёмного к светлому.
    const ramp = [style.palette.ink, ...style.palette.accents, style.palette.paper]
      .sort((a, b) => hexToOklch(a).l - hexToOklch(b).l).map(hexRgb);
    for (let o = 0; o < img.data.length; o += 4) {
      const l = lumOf(img.data[o], img.data[o + 1], img.data[o + 2]);
      const c2 = ramp[Math.min(ramp.length - 1, Math.floor(l * ramp.length))];
      img.data[o] = c2[0]; img.data[o + 1] = c2[1]; img.data[o + 2] = c2[2];
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function pickWindows(rc: RenderCtx, i: number): Zone[] {
    const { zone } = rc;
    const rand = mulberry32(rc.style.seed * 17 + i);
    const cw = zone.w / COLS, ch = zone.h / ROWS;
    const out: Zone[] = [];
    const count = 3 + Math.floor(rand() * 2);
    for (let k = 0; k < count; k++) {
      const w = 2 + Math.floor(rand() * 3), h = 2 + Math.floor(rand() * 4);
      const c = Math.floor(rand() * (COLS - w + 1)), r = Math.floor(rand() * (ROWS - h + 1));
      out.push({ x: zone.x + c * cw, y: zone.y + r * ch, w: w * cw, h: h * ch });
    }
    return out;
  }

  function drawShape(g: CanvasRenderingContext2D, s: Shape, scale: number) {
    g.save();
    g.translate(s.x, s.y);
    g.rotate(s.rot);
    g.scale(scale, scale);
    g.fillStyle = s.color;
    g.strokeStyle = s.color;
    g.lineWidth = s.w;
    g.beginPath();
    switch (s.kind) {
      case 'circle': g.arc(0, 0, s.s, 0, Math.PI * 2); g.fill(); break;
      case 'ring': g.arc(0, 0, s.s, 0, Math.PI * 2); g.stroke(); break;
      case 'half': g.arc(0, 0, s.s, 0, Math.PI); g.closePath(); g.fill(); break;
      case 'line': g.moveTo(-s.s * 1.6, 0); g.lineTo(s.s * 1.6, 0); g.stroke(); break;
      case 'arc': g.arc(0, 0, s.s, -Math.PI * 0.8, -Math.PI * 0.1); g.stroke(); break;
      case 'triangle': g.moveTo(0, -s.s); g.lineTo(s.s * 0.9, s.s * 0.7); g.lineTo(-s.s * 0.9, s.s * 0.7); g.closePath(); g.fill(); break;
      case 'checker': {
        const q = s.s / 2;
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if ((a + b) % 2 === 0) g.fillRect(-s.s * 0.75 + a * q, -s.s * 0.75 + b * q, q, q);
        break;
      }
    }
    g.restore();
  }

  return {
    prepare(rc) {
      poster = rc.photos.map((_, i) => posterize(rc, i));
      windows = rc.photos.map((_, i) => pickWindows(rc, i));
      const { zone, style } = rc;
      const rand = mulberry32(style.seed * 13 + 5);
      const count = Math.round(8 + 24 * style.composition.density);
      const colors = [...style.palette.accents, style.palette.ink];
      const kinds: ShapeKind[] = ['circle', 'ring', 'half', 'line', 'arc', 'checker', 'triangle', 'line', 'circle'];
      shapes = Array.from({ length: count }, () => {
        // Композиция по диагонали снизу-слева вверх-вправо с разбросом.
        const t = rand();
        const along = { x: zone.x + zone.w * t, y: zone.y + zone.h * (1 - t) };
        const spread = (0.15 + 0.25 * style.composition.asymmetry) * zone.w;
        return {
          kind: pick(rand, kinds),
          x: along.x + (rand() - 0.5) * spread * 2,
          y: along.y + (rand() - 0.5) * spread * 2,
          s: range(rand, 18, 150) * (rand() > 0.85 ? 1.6 : 1),
          rot: rand() * Math.PI * 2,
          color: pick(rand, colors),
          w: range(rand, 3, 12),
        };
      });
    },
    drawPhoto(rc, pt) {
      const { ctx: g, zone, style } = rc;
      g.save();
      g.fillStyle = rgba(style.palette.paper, 0.9);
      g.fillRect(zone.x, zone.y, zone.w, zone.h);
      // Сетка
      g.strokeStyle = rgba(style.palette.ink, 0.12);
      g.lineWidth = 1.5;
      for (let c = 0; c <= COLS; c++) { const x = zone.x + (zone.w / COLS) * c; g.beginPath(); g.moveTo(x, zone.y); g.lineTo(x, zone.y + zone.h); g.stroke(); }
      for (let r = 0; r <= ROWS; r++) { const y = zone.y + (zone.h / ROWS) * r; g.beginPath(); g.moveTo(zone.x, y); g.lineTo(zone.x + zone.w, y); g.stroke(); }
      const show = (i: number, alpha: number) => {
        if (alpha <= 0) return;
        g.globalAlpha = alpha;
        for (const w of windows[i]) {
          g.save();
          g.beginPath(); g.rect(w.x, w.y, w.w, w.h); g.clip();
          g.drawImage(poster[i], zone.x, zone.y, zone.w, zone.h);
          g.restore();
          g.strokeStyle = style.palette.ink;
          g.lineWidth = 3;
          g.strokeRect(w.x, w.y, w.w, w.h);
        }
        g.globalAlpha = 1;
      };
      if (pt.transition < 1) show(pt.prevIndex, 1 - pt.transition);
      show(pt.index, pt.transition);
      g.restore();
    },
    drawOverlay(rc, pt, alpha) {
      const g = rc.ctx;
      g.save();
      g.globalAlpha = alpha;
      const e = rc.energy(pt);
      const pulseIdx = shapes.length ? pt.beat % shapes.length : 0;
      const pulse = 1 + 0.08 * (1 + rc.style.motion.jitter) * Math.exp(-pt.beatPhase * 5);
      shapes.forEach((s, i) => drawShape(g, { ...s, rot: s.rot + pt.t * 0.04 * (i % 2 ? 1 : -1) * rc.style.motion.jitter }, i === pulseIdx ? pulse : 1 + 0.03 * e));
      g.restore();
    },
  };
}
