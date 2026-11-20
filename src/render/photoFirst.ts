// «Фото главное»: настоящая фотография всегда видна чётко — человека, место, свет можно узнать через год.
// Техника дня (мазки, геометрия, плёнка…) живёт вокруг и под фото как атмосфера и рамка,
// а на само фото ложится только мягкая цветокоррекция под палитру дня.
// Движение как в видео: медленный наезд камеры (Ken Burns) и плавная смена кадров в ритме песни.
import type { StyleParams, Technique } from '@/lib/types';
import { rgba } from './draw';
import { mulberry32 } from './rng';
import type { PhotoTime } from './timeline';
import type { RenderPhoto, Zone } from './types';

/** Насколько фото отступает от края фото-зоны: чем «тише» техника, тем больше воздуха вокруг. */
const INSET: Record<Technique, number> = { minimal: 0.13, impressionist: 0.06, geometric: 0.08, film: 0.05, collage: 0.09 };

/** Цветокоррекция — объяснимая: техника задаёт характер, палитра дня — оттенок. */
const GRADE: Record<Technique, string> = {
  impressionist: 'saturate(1.12) brightness(1.04) contrast(0.95)',
  geometric: 'contrast(1.12) saturate(0.86)',
  minimal: 'saturate(0.82) brightness(1.05) contrast(0.97)',
  film: 'sepia(0.22) contrast(1.06) saturate(0.92)',
  collage: 'saturate(1.18) contrast(1.05)',
};

export function innerRect(zone: Zone, tech: Technique): Zone {
  const p = INSET[tech] * zone.w;
  return { x: zone.x + p, y: zone.y + p, w: zone.w - 2 * p, h: zone.h - 2 * p };
}

/** Наезд камеры: чётные кадры приближаются, нечётные отдаляются; направление сдвига — от seed. */
export function kenBurns(index: number, local: number, seed: number) {
  const rand = mulberry32(seed * 31 + index * 977);
  const zoomIn = index % 2 === 0;
  const z = zoomIn ? 1.04 + 0.09 * local : 1.13 - 0.09 * local;
  const dx = (rand() - 0.5) * 0.06 * local;
  const dy = (rand() - 0.5) * 0.05 * local;
  return { z, dx, dy };
}

function drawPhoto(g: CanvasRenderingContext2D, p: RenderPhoto, r: Zone, kb: { z: number; dx: number; dy: number }) {
  const k = Math.max(r.w / p.w, r.h / p.h) * kb.z;
  const sw = r.w / k, sh = r.h / k;
  const sx = Math.min(p.w - sw, Math.max(0, (p.w - sw) / 2 + kb.dx * p.w));
  const sy = Math.min(p.h - sh, Math.max(0, (p.h - sh) / 2 + kb.dy * p.h));
  g.drawImage(p.img, sx, sy, sw, sh, r.x, r.y, r.w, r.h);
}

export function createPhotoFirst(style: StyleParams, photos: RenderPhoto[], zone: Zone) {
  const tech = style.techniques.primary;
  const r = innerRect(zone, tech);
  const accent = style.palette.accents[0] ?? style.palette.ink;
  const tilt = tech === 'collage' ? ((style.seed % 7) - 3) * 0.6 * (Math.PI / 180) : 0;
  const filterOk = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;

  function frameBehind(g: CanvasRenderingContext2D) {
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.35)';
    g.shadowBlur = tech === 'minimal' ? 18 : 34;
    g.shadowOffsetY = 12;
    if (tech === 'collage') {
      // Полароид: белая рамка, внизу шире — место для подписи.
      g.fillStyle = '#fbf8f2';
      g.fillRect(r.x - 22, r.y - 22, r.w + 44, r.h + 96);
    } else if (tech === 'film') {
      g.fillStyle = '#111';
      g.fillRect(r.x - 30, r.y - 54, r.w + 60, r.h + 108);
    } else if (tech === 'geometric') {
      // Жёсткая тень-плашка в цвет дня: геометрия остаётся, но рядом с фото, а не на нём.
      g.shadowColor = 'transparent';
      g.fillStyle = accent;
      g.fillRect(r.x + 22, r.y + 22, r.w, r.h);
    } else {
      g.fillStyle = style.palette.paper;
      g.fillRect(r.x, r.y, r.w, r.h);
    }
    g.restore();
  }

  function frameFront(g: CanvasRenderingContext2D, date: string) {
    g.save();
    if (tech === 'film') {
      // Перфорация плёнки и оранжевая дата, как на мыльнице.
      g.fillStyle = 'rgba(240,235,225,0.85)';
      for (let x = r.x - 18; x < r.x + r.w + 18; x += 44) {
        g.fillRect(x, r.y - 40, 22, 16);
        g.fillRect(x, r.y + r.h + 24, 22, 16);
      }
      g.font = '600 34px monospace';
      g.fillStyle = 'rgba(255,150,40,0.9)';
      g.textAlign = 'right';
      const [y, m, d] = date.split('-');
      g.fillText(`'${y.slice(2)} ${m} ${d}`, r.x + r.w - 26, r.y + r.h - 26);
    } else if (tech === 'geometric') {
      g.strokeStyle = style.palette.ink;
      g.lineWidth = 4;
      g.strokeRect(r.x, r.y, r.w, r.h);
    } else if (tech === 'collage') {
      // Полоска скотча сверху.
      g.translate(r.x + r.w / 2, r.y - 10);
      g.rotate(-0.06);
      g.fillStyle = rgba(style.palette.paper, 0.75);
      g.fillRect(-90, -24, 180, 48);
    } else if (tech === 'impressionist') {
      // Мягкие края: фото «растворяется» в мазках вокруг.
      const f = 46;
      const edge = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
        const gr = g.createLinearGradient(x0, y0, x1, y1);
        gr.addColorStop(0, rgba(style.palette.paper, 0.85));
        gr.addColorStop(1, rgba(style.palette.paper, 0));
        g.fillStyle = gr;
        g.fillRect(rx, ry, rw, rh);
      };
      edge(r.x, 0, r.x + f, 0, r.x, r.y, f, r.h);
      edge(r.x + r.w, 0, r.x + r.w - f, 0, r.x + r.w - f, r.y, f, r.h);
      edge(0, r.y, 0, r.y + f, r.x, r.y, r.w, f);
      edge(0, r.y + r.h, 0, r.y + r.h - f, r.x, r.y + r.h - f, r.w, f);
    } else {
      g.strokeStyle = rgba(style.palette.ink, 0.25);
      g.lineWidth = 1.5;
      g.strokeRect(r.x, r.y, r.w, r.h);
    }
    g.restore();
  }

  return {
    rect: r,
    draw(g: CanvasRenderingContext2D, pt: PhotoTime, date: string) {
      if (!photos.length) return;
      g.save();
      if (tilt) { g.translate(r.x + r.w / 2, r.y + r.h / 2); g.rotate(tilt); g.translate(-(r.x + r.w / 2), -(r.y + r.h / 2)); }
      frameBehind(g);
      g.save();
      g.beginPath();
      g.rect(r.x, r.y, r.w, r.h);
      g.clip();
      if (filterOk) g.filter = GRADE[tech];
      // Плавная смена кадров: предыдущее фото досматривается, новое проявляется поверх.
      if (pt.transition < 1 && photos.length > 1) {
        drawPhoto(g, photos[pt.prevIndex], r, kenBurns(pt.prevIndex, 1, style.seed));
        g.globalAlpha = pt.transition;
      }
      drawPhoto(g, photos[pt.index], r, kenBurns(pt.index, pt.local, style.seed));
      g.globalAlpha = 1;
      g.filter = 'none';
      // Оттенок дня: лёгкая вуаль акцентного цвета, фото остаётся узнаваемым.
      g.globalCompositeOperation = 'soft-light';
      g.fillStyle = rgba(accent, 0.22);
      g.fillRect(r.x, r.y, r.w, r.h);
      g.restore();
      frameFront(g, date);
      g.restore();
    },
  };
}
