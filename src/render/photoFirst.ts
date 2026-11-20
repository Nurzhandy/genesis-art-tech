// «Фото главное»: настоящая фотография всегда видна чётко — человека, место, свет можно узнать через год.
// Техника дня живёт вокруг и под фото как атмосфера и рамка, на само фото ложится мягкая коррекция.
// B11: V8 — люди чёткие, фон уходит в технику (в коллаже люди — наклейки с белым краем);
// V2 — кадр дышит на басу; V4 — свет того часа и ореол яркой точки; V6 — с возрастом цвета выцветают.
import type { StyleParams, Technique } from '@/lib/types';
import { DEFAULT_VISUAL } from '@/lib/style/visual';
import { ctx2d, makeCanvas, rgba } from './draw';
import { mulberry32 } from './rng';
import type { PhotoTime } from './timeline';
import type { RenderPhoto, Zone } from './types';

const INSET: Record<Technique, number> = { minimal: 0.13, impressionist: 0.06, geometric: 0.08, film: 0.05, collage: 0.09 };

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
  return { z, dx: (rand() - 0.5) * 0.06 * local, dy: (rand() - 0.5) * 0.05 * local };
}

/** Исходный прямоугольник фото для кадра (с наездом) — одинаковый для фото и его маски. */
function sourceRect(p: RenderPhoto, r: Zone, kb: { z: number; dx: number; dy: number }) {
  const k = Math.max(r.w / p.w, r.h / p.h) * kb.z;
  const sw = r.w / k, sh = r.h / k;
  return {
    sx: Math.min(p.w - sw, Math.max(0, (p.w - sw) / 2 + kb.dx * p.w)),
    sy: Math.min(p.h - sh, Math.max(0, (p.h - sh) / 2 + kb.dy * p.h)),
    sw, sh,
  };
}

/** Самая яркая точка фото (доли 0..1) — для ореола света (V4). Считается один раз. */
function brightestPoint(p: RenderPhoto): { x: number; y: number } {
  try {
    const c = makeCanvas(32, 32);
    const g = ctx2d(c);
    g.drawImage(p.img, 0, 0, 32, 32);
    const d = g.getImageData(0, 0, 32, 32).data;
    let best = -1, bi = 0;
    for (let i = 0; i < 32 * 32; i++) {
      const l = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
      if (l > best) { best = l; bi = i; }
    }
    return { x: (bi % 32 + 0.5) / 32, y: (Math.floor(bi / 32) + 0.5) / 32 };
  } catch { return { x: 0.5, y: 0.3 }; }
}

export interface PhotoFx { breath: number; desat: number }

export function createPhotoFirst(style: StyleParams, photos: RenderPhoto[], zone: Zone, masks: (HTMLCanvasElement | null)[] = []) {
  const tech = style.techniques.primary;
  const visual = style.visual ?? DEFAULT_VISUAL;
  const r = innerRect(zone, tech);
  const accent = style.palette.accents[0] ?? style.palette.ink;
  const tilt = tech === 'collage' ? ((style.seed % 7) - 3) * 0.6 * (Math.PI / 180) : 0;
  const filterOk = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;
  const bright = photos.map(brightestPoint);
  const usePeople = visual.portrait.focusPeople && masks.some(Boolean);
  // Холсты для вырезания людей: создаём один раз, рисуем в них каждый кадр.
  const cut = usePeople ? makeCanvas(r.w, r.h) : null;
  const sticker = usePeople && tech === 'collage' ? makeCanvas(r.w, r.h) : null;

  function frameBehind(g: CanvasRenderingContext2D) {
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.35)';
    g.shadowBlur = tech === 'minimal' ? 18 : 34;
    g.shadowOffsetY = 12;
    if (tech === 'collage') { g.fillStyle = '#fbf8f2'; g.fillRect(r.x - 22, r.y - 22, r.w + 44, r.h + 96); }
    else if (tech === 'film') { g.fillStyle = '#111'; g.fillRect(r.x - 30, r.y - 54, r.w + 60, r.h + 108); }
    else if (tech === 'geometric') { g.shadowColor = 'transparent'; g.fillStyle = accent; g.fillRect(r.x + 22, r.y + 22, r.w, r.h); }
    else if (!usePeople) { g.fillStyle = style.palette.paper; g.fillRect(r.x, r.y, r.w, r.h); }
    g.restore();
  }

  function frameFront(g: CanvasRenderingContext2D, date: string) {
    g.save();
    if (tech === 'film') {
      g.fillStyle = 'rgba(240,235,225,0.85)';
      for (let x = r.x - 18; x < r.x + r.w + 18; x += 44) { g.fillRect(x, r.y - 40, 22, 16); g.fillRect(x, r.y + r.h + 24, 22, 16); }
      g.font = '600 34px monospace';
      g.fillStyle = 'rgba(255,150,40,0.9)';
      g.textAlign = 'right';
      const [y, m, d] = date.split('-');
      g.fillText(`'${y.slice(2)} ${m} ${d}`, r.x + r.w - 26, r.y + r.h - 26);
    } else if (tech === 'geometric') {
      g.strokeStyle = style.palette.ink; g.lineWidth = 4; g.strokeRect(r.x, r.y, r.w, r.h);
    } else if (tech === 'collage') {
      g.translate(r.x + r.w / 2, r.y - 10); g.rotate(-0.06);
      g.fillStyle = rgba(style.palette.paper, 0.75); g.fillRect(-90, -24, 180, 48);
    } else if (tech === 'impressionist') {
      const f = 46;
      const edge = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
        const gr = g.createLinearGradient(x0, y0, x1, y1);
        gr.addColorStop(0, rgba(style.palette.paper, 0.85)); gr.addColorStop(1, rgba(style.palette.paper, 0));
        g.fillStyle = gr; g.fillRect(rx, ry, rw, rh);
      };
      edge(r.x, 0, r.x + f, 0, r.x, r.y, f, r.h);
      edge(r.x + r.w, 0, r.x + r.w - f, 0, r.x + r.w - f, r.y, f, r.h);
      edge(0, r.y, 0, r.y + f, r.x, r.y, r.w, f);
      edge(0, r.y + r.h, 0, r.y + r.h - f, r.x, r.y + r.h - f, r.w, f);
    } else {
      g.strokeStyle = rgba(style.palette.ink, 0.25); g.lineWidth = 1.5; g.strokeRect(r.x, r.y, r.w, r.h);
    }
    g.restore();
  }

  function filterFor(desat: number) {
    return filterOk ? `${GRADE[tech]}${desat > 0.005 ? ` saturate(${(1 - desat).toFixed(3)})` : ''}` : 'none';
  }

  /** Один кадр: фон фото (приглушён, если есть люди) + люди поверх чётко. */
  function drawFrame(g: CanvasRenderingContext2D, i: number, local: number, alpha: number, fx: PhotoFx) {
    const p = photos[i];
    const kb = kenBurns(i, local, style.seed);
    kb.z *= 1 + fx.breath;   // V2: бас — кадр дышит
    const s = sourceRect(p, r, kb);
    const mask = usePeople ? masks[i] : null;
    g.save();
    g.filter = filterFor(fx.desat);
    g.globalAlpha = alpha * (mask ? visual.portrait.backdrop : 1);
    g.drawImage(p.img, s.sx, s.sy, s.sw, s.sh, r.x, r.y, r.w, r.h);
    g.restore();
    if (!mask || !cut) return;
    // Люди: то же фото через маску → отдельный холст → поверх, без приглушения.
    const c = ctx2d(cut);
    c.save();
    c.clearRect(0, 0, cut.width, cut.height);
    c.filter = filterFor(fx.desat);
    c.drawImage(p.img, s.sx, s.sy, s.sw, s.sh, 0, 0, cut.width, cut.height);
    c.filter = 'none';
    c.globalCompositeOperation = 'destination-in';
    const mk = mask.width / p.w;
    c.drawImage(mask, s.sx * mk, s.sy * mk, s.sw * mk, s.sh * mk, 0, 0, cut.width, cut.height);
    c.restore();
    g.save();
    g.globalAlpha = alpha;
    if (sticker) {
      // Коллаж: человек — наклейка. Белый край 8 px = силуэт, растянутый во все стороны, и мягкая тень.
      const st = ctx2d(sticker);
      st.clearRect(0, 0, sticker.width, sticker.height);
      for (let a = 0; a < 8; a++) st.drawImage(cut, Math.cos((a * Math.PI) / 4) * 8, Math.sin((a * Math.PI) / 4) * 8);
      st.globalCompositeOperation = 'source-in';
      st.fillStyle = '#ffffff';
      st.fillRect(0, 0, sticker.width, sticker.height);
      st.globalCompositeOperation = 'source-over';
      g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
      g.drawImage(sticker, r.x, r.y);
      g.shadowColor = 'transparent';
    }
    g.drawImage(cut, r.x, r.y);
    g.restore();
  }

  return {
    rect: r,
    draw(g: CanvasRenderingContext2D, pt: PhotoTime, date: string, fx: PhotoFx = { breath: 0, desat: 0 }) {
      if (!photos.length) return;
      g.save();
      if (tilt) { g.translate(r.x + r.w / 2, r.y + r.h / 2); g.rotate(tilt); g.translate(-(r.x + r.w / 2), -(r.y + r.h / 2)); }
      frameBehind(g);
      g.save();
      g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip();
      if (pt.transition < 1 && photos.length > 1) drawFrame(g, pt.prevIndex, 1, 1, fx);
      drawFrame(g, pt.index, pt.local, pt.transition < 1 && photos.length > 1 ? pt.transition : 1, fx);
      // Оттенок дня и свет часа (V4): мягкие вуали, фото остаётся узнаваемым.
      g.globalCompositeOperation = 'soft-light';
      g.fillStyle = rgba(accent, 0.22);
      g.fillRect(r.x, r.y, r.w, r.h);
      if (visual.light.strength > 0) { g.fillStyle = rgba(visual.light.tint, visual.light.strength); g.fillRect(r.x, r.y, r.w, r.h); }
      if (visual.light.glow > 0) {
        const b = bright[pt.index];
        const gx = r.x + b.x * r.w, gy = r.y + b.y * r.h, rad = r.w * 0.55;
        const glow = tech === 'film' ? '#ff6a4a' : visual.light.tint === '#ffffff' ? '#ffe2b0' : visual.light.tint;
        const gr = g.createRadialGradient(gx, gy, 0, gx, gy, rad);
        gr.addColorStop(0, rgba(glow, visual.light.glow));
        gr.addColorStop(1, rgba(glow, 0));
        g.globalCompositeOperation = 'screen';
        g.fillStyle = gr;
        g.fillRect(r.x, r.y, r.w, r.h);
      }
      g.restore();
      frameFront(g, date);
      g.restore();
    },
  };
}
