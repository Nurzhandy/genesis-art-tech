// Атмосферный слой 3.5 (ресерч R3): между оверлеем техники и текстом. Положение каждой частицы —
// чистая функция времени, поэтому постер и живой просмотр совпадают.
import type { StyleParams } from '@/lib/types';
import { clamp, rgba } from './draw';
import { mulberry32, noise2, range } from './rng';
import type { PhotoTime } from './timeline';
import type { RenderCtx } from './types';

interface P { x: number; y: number; s: number; v: number; ph: number; c: string }

const MAX = 300;
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x));

export function createAtmosphere(style: StyleParams, W: number, H: number) {
  const atm = style.atmosphere ?? { kind: 'none' as const, amount: 0 };
  const rand = mulberry32(style.seed * 53 + 17);
  const per: Record<string, number> = { leaves: 70, snow: 260, rain: 300, mist: 14, dust: 160, lights: 40, none: 0 };
  const n = Math.min(MAX, Math.round((per[atm.kind] ?? 0) * (0.35 + atm.amount)));
  const warm = [...style.palette.accents];
  const parts: P[] = Array.from({ length: n }, () => ({
    x: rand() * W, y: rand() * H, s: rand(), v: range(rand, 0.6, 1.4), ph: rand() * Math.PI * 2,
    c: warm[Math.floor(rand() * warm.length)],
  }));
  const beatSec = 60 / style.motion.bpm;
  // Скорость падения пропорциональна темпу песни.
  const tempo = style.motion.bpm / 90;

  /** Время, которое «дёргается» в долю при резком ритме. */
  const motionTime = (t: number) => {
    if (style.motion.easing !== 'sharp') return t;
    const beats = t / beatSec;
    return (Math.floor(beats) + easeOutExpo(beats - Math.floor(beats))) * beatSec;
  };
  const wrap = (v: number, m: number) => ((v % m) + m) % m;

  function draw(rc: RenderCtx, pt: PhotoTime) {
    if (atm.kind === 'none' || !n) return;
    const g = rc.ctx;
    const t = motionTime(pt.t);
    const pulse = rc.energy(pt);
    // B11 V11: ветер того дня сносит частицы и наклоняет дождь (без данных о ветре — как раньше).
    const wind = style.visual?.wind ?? { angle: Math.PI / 2, strength: 0 };
    const windX = Math.cos(wind.angle) * wind.strength;
    const drift = windX * 160 * t;
    const slant = 0.12 + windX * 0.6;
    g.save();
    switch (atm.kind) {
      case 'leaves':
        for (const p of parts) {
          const y = wrap(p.y + t * 70 * tempo * p.v, H + 60) - 30;
          const x = wrap(drift + p.x + Math.sin(t * 0.9 * p.v + p.ph) * 40 + t * 12, W);
          const size = 14 + p.s * 20;
          g.save();
          g.translate(x, y);
          g.rotate(p.ph + t * 1.2 * p.v);
          g.scale(1, 0.45 + 0.4 * Math.abs(Math.sin(t * 2 * p.v + p.ph)));
          g.fillStyle = rgba(p.c, 0.75);
          g.beginPath();
          g.ellipse(0, 0, size, size * 0.5, 0, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = rgba(style.palette.ink, 0.35);
          g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(-size, 0); g.lineTo(size * 1.2, 0); g.stroke();
          g.restore();
        }
        break;
      case 'snow':
        g.fillStyle = 'rgba(255,255,255,0.85)';
        for (const p of parts) {
          const y = wrap(p.y + t * 45 * tempo * p.v, H + 20) - 10;
          const x = wrap(drift + p.x + Math.sin(t * 0.6 + p.ph) * 25, W);
          g.globalAlpha = 0.45 + 0.5 * p.s;
          g.beginPath(); g.arc(x, y, 1.5 + p.s * 4, 0, Math.PI * 2); g.fill();
        }
        break;
      case 'rain':
        // Цвет чернил: тёмные капли на светлой бумаге, светлые — на тёмной.
        g.strokeStyle = rgba(style.palette.ink, 0.45);
        g.lineCap = 'round';
        for (const p of parts) {
          const len = 24 + p.s * 36;
          const y = wrap(p.y + t * 900 * tempo * p.v, H + len) - len;
          const x = wrap(drift + p.x + y * slant, W);
          g.globalAlpha = 0.25 + 0.45 * p.s;
          g.lineWidth = 1 + p.s * 1.6;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + len * slant, y + len); g.stroke();
        }
        break;
      case 'mist':
        g.globalCompositeOperation = 'screen';
        for (const p of parts) {
          const r = 260 + p.s * 340;
          const x = wrap(drift + p.x + t * 18 * p.v, W + r * 2) - r;
          const y = p.y * 0.8 + Math.sin(t * 0.3 + p.ph) * 40 - t * 6 * p.v % (H * 0.3);
          const gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, rgba(style.palette.paper, 0.16 * atm.amount + 0.06));
          gr.addColorStop(1, rgba(style.palette.paper, 0));
          g.fillStyle = gr;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        break;
      case 'dust': {
        // Луч света по диагонали и пылинки в нём.
        g.globalCompositeOperation = 'screen';
        const beam = g.createLinearGradient(W * 0.1, 0, W * 0.75, H);
        beam.addColorStop(0, 'rgba(255,240,200,0)');
        beam.addColorStop(0.45, `rgba(255,236,190,${0.10 + 0.05 * pulse})`);
        beam.addColorStop(1, 'rgba(255,240,200,0)');
        g.fillStyle = beam;
        g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(255,245,220,0.9)';
        for (const p of parts) {
          const x = wrap(drift + p.x + noise2(p.ph, t * 0.08, 5) * 120 - 60 + t * 4, W);
          const y = wrap(p.y - t * 8 * p.v + noise2(t * 0.08, p.ph, 6) * 80, H);
          g.globalAlpha = clamp(0.2 + 0.7 * p.s * (0.6 + 0.4 * Math.sin(t * 2 + p.ph)));
          g.beginPath(); g.arc(x, y, 1 + p.s * 2.4, 0, Math.PI * 2); g.fill();
        }
        break;
      }
      case 'lights':
        g.globalCompositeOperation = 'screen';
        for (const p of parts) {
          const x = wrap(drift + p.x + Math.sin(t * 0.2 + p.ph) * 20, W);
          const y = wrap(p.y + Math.cos(t * 0.15 + p.ph) * 14, H);
          const r = (18 + p.s * 46) * (1 + 0.15 * pulse);
          const gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, rgba(p.c, 0.35 + 0.25 * pulse));
          gr.addColorStop(0.6, rgba(p.c, 0.12));
          gr.addColorStop(1, rgba(p.c, 0));
          g.fillStyle = gr;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        break;
    }
    g.restore();
  }

  return { draw, kind: atm.kind };
}
