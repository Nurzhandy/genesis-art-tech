// Песня как предмет на странице (ресерч S2): пластинка, кассета, CD или стикер плеера,
// приклеенный скотчем к углу фото. Вращение и пульс — по темпу песни; положение одинаково у всех дней.
import type { StyleParams } from '@/lib/types';
import { LAYOUT } from '@/lib/style/constants';
import { clamp, rgba } from './draw';
import type { Fonts } from './types';

/** Центр и размер предмета в долях холста — по ним страница дня кладёт кнопку «включить песню». */
export function songObjectPlace(W: number, H: number) {
  const r = 0.115 * W;
  const cx = (LAYOUT.photo.x + LAYOUT.photo.w) * W - 0.13 * W;
  const cy = (LAYOUT.photo.y + LAYOUT.photo.h) * H - 0.012 * H;
  return { cx, cy, r, box: { x: (cx - 1.15 * r) / W, y: (cy - 1.15 * r) / H, w: (2.3 * r) / W, h: (2.3 * r) / H } };
}

const fit = (g: CanvasRenderingContext2D, s: string, max: number) => {
  if (g.measureText(s).width <= max) return s;
  let t = s;
  while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
};

function vinyl(g: CanvasRenderingContext2D, r: number, style: StyleParams, fonts: Fonts, angle: number, label: string) {
  g.fillStyle = '#141313';
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  // Дорожки
  g.lineWidth = 1.2;
  for (let k = 0.42; k < 0.97; k += 0.045) {
    g.strokeStyle = `rgba(255,255,255,${0.05 + 0.04 * Math.sin(k * 40)})`;
    g.beginPath(); g.arc(0, 0, r * k, 0, Math.PI * 2); g.stroke();
  }
  g.rotate(angle);
  // Блик, который «едет» при вращении
  const sheen = g.createLinearGradient(-r, -r, r, r);
  sheen.addColorStop(0.35, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.13)');
  sheen.addColorStop(0.65, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  // Яблоко пластинки в цвет дня
  g.fillStyle = style.palette.accents[0] ?? style.palette.paper;
  g.beginPath(); g.arc(0, 0, r * 0.36, 0, Math.PI * 2); g.fill();
  g.fillStyle = rgba(style.palette.ink, 0.85);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `500 ${Math.round(r * 0.11)}px ${fonts.mono}`;
  g.fillText(fit(g, label.toUpperCase(), r * 0.6), 0, -r * 0.13);
  g.fillStyle = '#141313';
  g.beginPath(); g.arc(0, 0, r * 0.035, 0, Math.PI * 2); g.fill();
}

function cd(g: CanvasRenderingContext2D, r: number, style: StyleParams, angle: number) {
  g.rotate(angle);
  const conic = (g as CanvasRenderingContext2D & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient }).createConicGradient;
  const grad = conic ? conic.call(g, 0, 0, 0) : g.createRadialGradient(0, 0, 0, 0, 0, r);
  ['#d8dde3', '#f2d7ef', '#cfe8f7', '#f7f1c8', '#d6f2dc', '#d8dde3'].forEach((c, i, a) => grad.addColorStop(i / (a.length - 1), c));
  g.fillStyle = grad;
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = rgba(style.palette.accents[0] ?? '#ffffff', 0.25);
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, r * 0.3, 0, Math.PI * 2); g.stroke();
  // Отверстие — цвет бумаги под диском
  g.fillStyle = style.palette.bg;
  g.beginPath(); g.arc(0, 0, r * 0.11, 0, Math.PI * 2); g.fill();
}

function rounded(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number) {
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + h, rad);
  g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
}

function cassette(g: CanvasRenderingContext2D, r: number, style: StyleParams, fonts: Fonts, angle: number, label: string) {
  const w = 2.1 * r, h = 1.35 * r;
  g.fillStyle = '#2b2a2a';
  rounded(g, -w / 2, -h / 2, w, h, r * 0.1); g.fill();
  // Наклейка с названием, как подписывали от руки
  g.fillStyle = style.palette.paper;
  rounded(g, -w * 0.42, -h * 0.4, w * 0.84, h * 0.5, r * 0.05); g.fill();
  g.fillStyle = style.palette.accents[0] ?? style.palette.ink;
  g.fillRect(-w * 0.42, -h * 0.4, w * 0.84, h * 0.07);
  g.fillStyle = rgba(style.palette.ink, 0.9);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `500 ${Math.round(r * 0.2)}px ${fonts.hand}`;
  g.fillText(fit(g, label, w * 0.78), 0, -h * 0.2);
  // Окно и катушки
  g.fillStyle = 'rgba(0,0,0,0.55)';
  rounded(g, -w * 0.28, h * 0.02, w * 0.56, h * 0.26, r * 0.08); g.fill();
  for (const sx of [-1, 1]) {
    g.save();
    g.translate(sx * w * 0.17, h * 0.15);
    g.rotate(angle);
    g.fillStyle = '#e9e4da';
    g.beginPath(); g.arc(0, 0, r * 0.11, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2b2a2a';
    for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); g.fillRect(r * 0.04, -r * 0.012, r * 0.06, r * 0.024); }
    g.restore();
  }
}

function stream(g: CanvasRenderingContext2D, r: number, style: StyleParams, fonts: Fonts, t: number, pulse: number, label: string) {
  const w = 2.0 * r, h = 1.2 * r;
  g.fillStyle = rgba(style.palette.paper, 0.96);
  rounded(g, -w / 2, -h / 2, w, h, r * 0.22); g.fill();
  g.strokeStyle = rgba(style.palette.ink, 0.15); g.lineWidth = 2; g.stroke();
  // Эквалайзер в долю
  const bars = 7, bw = w * 0.07, gap = w * 0.035, x0 = -((bars * bw + (bars - 1) * gap) / 2);
  g.fillStyle = style.palette.accents[0] ?? style.palette.ink;
  for (let i = 0; i < bars; i++) {
    const wave = 0.5 + 0.5 * Math.sin(t * 7 + i * 1.7);
    const bh = h * (0.12 + 0.38 * clamp(0.35 * wave + 0.65 * pulse * (0.6 + 0.4 * wave)));
    rounded(g, x0 + i * (bw + gap), h * 0.08 - bh, bw, bh, bw / 2); g.fill();
  }
  g.fillStyle = rgba(style.palette.ink, 0.85);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `500 ${Math.round(r * 0.15)}px ${fonts.mono}`;
  g.fillText(fit(g, `♪ ${label}`, w * 0.86), 0, h * 0.3);
}

/** Полоска скотча поверх предмета: он «приклеен» к странице. */
function tape(g: CanvasRenderingContext2D, r: number, style: StyleParams) {
  g.save();
  g.rotate(-0.5);
  g.fillStyle = rgba(style.palette.paper, 0.72);
  g.fillRect(-r * 0.32, -r * 1.12, r * 0.64, r * 0.3);
  g.restore();
}

export function drawSongObject(g: CanvasRenderingContext2D, W: number, H: number, style: StyleParams, fonts: Fonts, songLabel: string | undefined, t: number, pulse: number) {
  const obj = style.songObject;
  if (!obj) return;
  const { cx, cy, r } = songObjectPlace(W, H);
  const angle = t * obj.revPerSec * Math.PI * 2;
  const label = songLabel?.trim() || (obj.year ? String(obj.year) : 'песня дня');
  g.save();
  g.translate(cx, cy);
  g.rotate(((-style.typography.captionTilt) * 0.8 * Math.PI) / 180);
  g.shadowColor = 'rgba(0,0,0,0.35)';
  g.shadowBlur = 24;
  g.shadowOffsetY = 8;
  // Тень рисуем один раз — силуэтом, иначе каждая деталь даст свою тень.
  g.fillStyle = 'rgba(0,0,0,0.001)';
  if (obj.kind === 'vinyl' || obj.kind === 'cd') { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); }
  else { rounded(g, -r, -0.65 * r, 2 * r, 1.3 * r, r * 0.15); g.fill(); }
  g.shadowColor = 'transparent';
  g.save();
  if (obj.kind === 'vinyl') vinyl(g, r, style, fonts, angle, obj.year ? `${obj.year}` : label);
  else if (obj.kind === 'cd') cd(g, r, style, angle);
  else if (obj.kind === 'cassette') cassette(g, r, style, fonts, angle, label);
  else stream(g, r, style, fonts, t, pulse, label);
  g.restore();
  tape(g, r, style);
  g.restore();
}
