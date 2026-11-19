// Японский минимализм (ма): одно маленькое фото, много воздуха, линия горизонта, печать-акцент (B6).
import { clamp, drawCover, rgba } from '../draw';
import { mulberry32 } from '../rng';
import type { TechniqueRenderer, Zone } from '../types';

const GOLD = 0.382;

export function createMinimal(): TechniqueRenderer {
  let win: Zone = { x: 0, y: 0, w: 0, h: 0 };
  let left = true;
  let horizonY = 0;

  return {
    prepare(rc) {
      const { zone, style } = rc;
      const rand = mulberry32(style.seed * 7 + 3);
      left = rand() > 0.5;
      const w = zone.w * clamp(1 - style.composition.negativeSpace * 0.75, 0.35, 0.8);
      const h = w * 1.25;
      const cx = zone.x + zone.w * (left ? GOLD : 1 - GOLD);
      const cy = zone.y + zone.h * GOLD;
      win = { x: cx - w / 2, y: cy - h / 2, w, h };
      horizonY = zone.y + zone.h * (0.74 + rand() * 0.06);
    },
    drawPhoto(rc, pt) {
      const g = rc.ctx;
      const draw = (i: number, alpha: number, zoom: number) => {
        if (alpha <= 0.001) return;
        const p = rc.photos[i];
        g.save();
        g.globalAlpha = alpha;
        drawCover(g, p.img, p.w, p.h, win, zoom);
        g.restore();
      };
      // Затухание через бумагу: старое уходит в первой половине перехода, новое проявляется во второй.
      const tr = pt.transition;
      const zoom = 1 + 0.03 * pt.local;
      if (tr < 1) draw(pt.prevIndex, clamp(1 - tr * 2), 1.03);
      draw(pt.index, tr >= 1 ? 1 : clamp(tr * 2 - 1), zoom);
      g.save();
      g.strokeStyle = rgba(rc.style.palette.ink, 0.2);
      g.lineWidth = 1;
      g.strokeRect(win.x, win.y, win.w, win.h);
      g.restore();
    },
    drawOverlay(rc, pt, alpha) {
      const { ctx: g, zone, style } = rc;
      g.save();
      g.globalAlpha = alpha;
      // Линия горизонта
      g.strokeStyle = rgba(style.palette.ink, 0.45);
      g.lineWidth = 1.5;
      const x0 = left ? zone.x : zone.x + zone.w * 0.4;
      g.beginPath(); g.moveTo(x0, horizonY); g.lineTo(x0 + zone.w * 0.6, horizonY); g.stroke();
      // Печать-акцент, едва дышит
      const s = 30 * (1 + 0.04 * rc.energy(pt));
      const sx = left ? win.x + win.w + 28 : win.x - 28 - s;
      g.fillStyle = style.palette.accents[0];
      g.fillRect(sx, win.y + win.h - s, s, s);
      g.restore();
    },
  };
}
