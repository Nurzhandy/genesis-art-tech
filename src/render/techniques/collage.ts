// Коллаж: несколько фото сразу, рваные края, повороты, скотч и цветная бумага; фото прилетают в долю (B7).
import { clamp, coverSource, rgba } from '../draw';
import { mulberry32, noise2, range } from '../rng';
import type { PhotoTime } from '../timeline';
import type { RenderCtx, TechniqueRenderer } from '../types';

interface Piece { cx: number; cy: number; w: number; h: number; rot: number; seed: number; fromX: number; fromY: number }
interface Scrap { pts: [number, number][]; color: string }

function tornRect(w: number, h: number, seed: number, amp = 7, step = 10): [number, number][] {
  const pts: [number, number][] = [];
  const j = (k: number) => (noise2(k * 0.35, seed, seed) - 0.5) * 2 * amp;
  let k = 0;
  for (let x = -w / 2; x < w / 2; x += step) pts.push([x, -h / 2 + j(k++)]);
  for (let y = -h / 2; y < h / 2; y += step) pts.push([w / 2 + j(k++), y]);
  for (let x = w / 2; x > -w / 2; x -= step) pts.push([x, h / 2 + j(k++)]);
  for (let y = h / 2; y > -h / 2; y -= step) pts.push([-w / 2 + j(k++), y]);
  return pts;
}

const path = (g: CanvasRenderingContext2D, pts: [number, number][]) => {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
};

const easeOutBack = (x: number) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;

export function createCollage(): TechniqueRenderer {
  let layouts: Piece[][] = [];
  let scraps: Scrap[] = [];
  let visible = 2;

  function piecesFor(rc: RenderCtx, slot: number): Piece[] {
    const { zone, style } = rc;
    const rand = mulberry32(style.seed * 41 + slot);
    return Array.from({ length: visible }, (_, k) => {
      const w = zone.w * range(rand, 0.5, 0.66);
      const h = w * range(rand, 1.05, 1.35);
      const cx = zone.x + w / 2 + rand() * (zone.w - w);
      const cy = zone.y + h / 2 + ((zone.h - h) * (k + rand() * 0.6)) / Math.max(1, visible - 0.4);
      const ang = rand() * Math.PI * 2;
      return {
        cx, cy: Math.min(zone.y + zone.h - h / 2, cy), w, h,
        rot: ((rand() - 0.5) * 16 * Math.PI) / 180,
        seed: Math.floor(rand() * 1000),
        fromX: Math.cos(ang) * zone.w * 0.6, fromY: Math.sin(ang) * zone.h * 0.4,
      };
    });
  }

  function drawPiece(rc: RenderCtx, photoIdx: number, pc: Piece, enter: number) {
    const g = rc.ctx;
    const p = rc.photos[photoIdx];
    const e = easeOutBack(clamp(enter));
    g.save();
    g.translate(pc.cx + pc.fromX * (1 - e), pc.cy + pc.fromY * (1 - e));
    g.rotate(pc.rot * (0.6 + 0.4 * e));
    const pts = tornRect(pc.w, pc.h, pc.seed);
    g.shadowColor = 'rgba(0,0,0,0.28)';
    g.shadowBlur = 18; g.shadowOffsetY = 8;
    path(g, pts);
    g.fillStyle = '#f6f1e7';
    g.fill();
    g.shadowColor = 'transparent';
    g.save();
    path(g, tornRect(pc.w - 22, pc.h - 22, pc.seed + 1, 4));
    g.clip();
    const s = coverSource(p.w, p.h, pc.w - 22, pc.h - 22);
    g.drawImage(p.img, s.sx, s.sy, s.sw, s.sh, -(pc.w - 22) / 2, -(pc.h - 22) / 2, pc.w - 22, pc.h - 22);
    g.restore();
    // Скотч
    g.fillStyle = 'rgba(236,224,190,0.72)';
    g.save();
    g.translate((pc.seed % 3 - 1) * pc.w * 0.2, -pc.h / 2);
    g.rotate(((pc.seed % 7) - 3) * 0.05);
    g.fillRect(-55, -16, 110, 32);
    g.restore();
    g.restore();
  }

  return {
    prepare(rc) {
      const { zone, style, photos } = rc;
      visible = Math.min(photos.length, style.composition.density > 0.6 ? 4 : 3, Math.max(2, photos.length));
      visible = Math.max(1, visible);
      layouts = [];
      const rand = mulberry32(style.seed * 23 + 1);
      scraps = Array.from({ length: 6 }, (_, k) => {
        const w = range(rand, 120, 320), h = range(rand, 80, 260);
        const cx = zone.x + rand() * zone.w, cy = zone.y + rand() * zone.h;
        const rot = (rand() - 0.5) * 0.6;
        return {
          pts: tornRect(w, h, 500 + k, 10, 14).map(([x, y]) => [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)] as [number, number]),
          color: style.palette.accents[k % style.palette.accents.length],
        };
      });
    },
    drawPhoto(rc, pt: PhotoTime) {
      const n = rc.photos.length;
      const slot = pt.cycle * n + pt.index;
      layouts[slot % 64] ??= piecesFor(rc, slot);
      const pieces = layouts[slot % 64];
      // Последнее фото в стопке — новое, оно прилетает в начале кадра.
      for (let k = 0; k < pieces.length; k++) {
        const idx = (pt.index + k - (pieces.length - 1) + n * 4) % n;
        const isNew = k === pieces.length - 1;
        drawPiece(rc, idx, pieces[k], isNew ? pt.transition : 1);
      }
    },
    drawOverlay(rc, pt, alpha) {
      const g = rc.ctx;
      g.save();
      g.globalAlpha = alpha * 0.85;
      g.globalCompositeOperation = 'multiply';
      const bump = 1 + 0.02 * rc.energy(pt);
      for (const s of scraps) {
        g.save();
        const [cx, cy] = s.pts[0];
        g.translate(cx, cy); g.scale(bump, bump); g.translate(-cx, -cy);
        path(g, s.pts);
        g.fillStyle = rgba(s.color, 0.55);
        g.fill();
        g.restore();
      }
      g.restore();
    },
  };
}
