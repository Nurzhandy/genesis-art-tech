// Плёночная фотография: кадр на плёнке, тёплые тени, ореол, засветки, дрожание кадра (B6).
import { clamp, drawCover } from '../draw';
import { mulberry32, noise2 } from '../rng';
import type { RenderCtx, TechniqueRenderer, Zone } from '../types';

const STRIP = 64;   // ширина плёнки с перфорацией

export function createFilm(): TechniqueRenderer {
  let inner: Zone = { x: 0, y: 0, w: 0, h: 0 };
  let leakSlots = new Set<number>();
  const supportsFilter = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;

  function photo(rc: RenderCtx, i: number, alpha: number, dx: number, dy: number) {
    if (alpha <= 0.001) return;
    const g = rc.ctx;
    const p = rc.photos[i];
    const r = { ...inner, x: inner.x + dx, y: inner.y + dy };
    g.save();
    g.beginPath(); g.rect(inner.x, inner.y, inner.w, inner.h); g.clip();
    g.globalAlpha = alpha;
    drawCover(g, p.img, p.w, p.h, r, 1.02);
    // Тёплый сдвиг теней
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = 'rgba(255,160,80,0.35)';
    g.fillRect(inner.x, inner.y, inner.w, inner.h);
    // Ореол вокруг светлых зон
    if (supportsFilter) {
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = alpha * 0.22;
      g.filter = 'blur(14px)';
      drawCover(g, p.img, p.w, p.h, r, 1.02);
      g.filter = 'none';
    }
    g.restore();
  }

  return {
    prepare(rc) {
      const { zone, style } = rc;
      inner = { x: zone.x + STRIP, y: zone.y + 28, w: zone.w - STRIP * 2, h: zone.h - 56 };
      const rand = mulberry32(style.seed * 3 + 11);
      leakSlots = new Set(Array.from({ length: rc.photos.length }, (_, i) => i).filter(() => rand() < 0.45));
      if (!leakSlots.size) leakSlots.add(0);
    },
    drawPhoto(rc, pt) {
      const { ctx: g, zone, style, fonts } = rc;
      // Плёнка
      g.save();
      g.fillStyle = '#141210';
      g.fillRect(zone.x, zone.y, zone.w, zone.h);
      g.fillStyle = 'rgba(240,230,210,0.85)';
      for (let y = zone.y + 18; y < zone.y + zone.h - 30; y += 46) {
        for (const x of [zone.x + 20, zone.x + zone.w - 44]) {
          g.beginPath(); g.roundRect(x, y, 24, 30, 5); g.fill();
        }
      }
      g.restore();
      const weave = style.motion.jitter * 4;
      const dx = (noise2(pt.t * 3, 1, style.seed) - 0.5) * weave;
      const dy = (noise2(1, pt.t * 3, style.seed) - 0.5) * weave;
      if (pt.transition < 1) photo(rc, pt.prevIndex, 1 - pt.transition, dx, dy);
      photo(rc, pt.index, pt.transition, dx, dy);
      // Номер кадра
      g.save();
      g.font = `600 20px ${fonts.mono}`;
      g.fillStyle = '#e0a040';
      g.textAlign = 'left';
      g.fillText(`${String(pt.index + 1).padStart(2, '0')}A ▸  KODAK 400`, inner.x, zone.y + zone.h - 6);
      g.restore();
    },
    drawOverlay(rc, pt, alpha) {
      const { ctx: g, zone } = rc;
      if (!leakSlots.has(pt.index)) return;
      const bell = Math.sin(clamp(pt.local) * Math.PI);
      if (bell < 0.02) return;
      g.save();
      g.globalCompositeOperation = 'screen';
      const rand = mulberry32(pt.index * 101 + pt.cycle);
      for (let k = 0; k < 2; k++) {
        const edgeX = rand() > 0.5 ? zone.x + zone.w : zone.x;
        const y = zone.y + zone.h * rand();
        const r = zone.w * (0.35 + rand() * 0.3);
        const gr = g.createRadialGradient(edgeX, y, 0, edgeX, y, r);
        gr.addColorStop(0, `rgba(255,120,40,${0.55 * bell * alpha})`);
        gr.addColorStop(0.5, `rgba(255,60,30,${0.2 * bell * alpha})`);
        gr.addColorStop(1, 'rgba(255,60,30,0)');
        g.fillStyle = gr;
        g.fillRect(zone.x, zone.y, zone.w, zone.h);
      }
      g.restore();
    },
  };
}
