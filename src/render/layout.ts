// Постоянные элементы дневника: бумага, дата, название, подпись, нижняя строка (B2).
import type { StyleParams } from '@/lib/types';
import { LAYOUT } from '@/lib/style/constants';
import { makeCanvas, ctx2d, rgba } from './draw';
import { mulberry32 } from './rng';
import type { DayInfo, Fonts, Zone } from './types';

export const zoneOf = (W: number, H: number): Zone => ({
  x: LAYOUT.photo.x * W, y: LAYOUT.photo.y * H, w: LAYOUT.photo.w * W, h: LAYOUT.photo.h * H,
});

export function makePaper(style: StyleParams, W: number, H: number): HTMLCanvasElement {
  const c = makeCanvas(W, H);
  const g = ctx2d(c);
  const rand = mulberry32(style.seed ^ 0x9e3779b9);
  g.fillStyle = style.palette.bg;
  g.fillRect(0, 0, W, H);
  // Пятна бумаги
  for (let i = 0; i < 14; i++) {
    const x = rand() * W, y = rand() * H, r = 200 + rand() * 500;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(style.palette.paper, 0.35 * style.texture.paper));
    gr.addColorStop(1, rgba(style.palette.paper, 0));
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Волокна
  g.lineCap = 'round';
  const fibers = Math.round(1800 * (0.4 + style.texture.paper));
  for (let i = 0; i < fibers; i++) {
    const x = rand() * W, y = rand() * H, a = rand() * Math.PI, l = 4 + rand() * 18;
    g.strokeStyle = rgba(rand() > 0.5 ? style.palette.ink : style.palette.paper, 0.025 + 0.05 * rand() * style.texture.paper);
    g.lineWidth = 0.6 + rand();
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  return c;
}

function setSpacing(g: CanvasRenderingContext2D, px: number) {
  if ('letterSpacing' in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
}

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > maxW && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Обрезает название песни многоточием, чтобы строка с BPM влезла в maxW (BPM не теряем). */
export function fitSongLine(measure: (t: string) => number, label: string | undefined, bpm: number, maxW: number): string {
  const tail = ` · ${Math.round(bpm)} BPM`;
  if (!label) return `♪${tail}`;
  const full = `♪ ${label}${tail}`;
  if (measure(full) <= maxW) return full;
  const chars = Array.from(label);
  for (let n = chars.length - 1; n > 0; n--) {
    const t = `♪ ${chars.slice(0, n).join('').trimEnd()}…${tail}`;
    if (measure(t) <= maxW) return t;
  }
  return `♪${tail}`;
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

export function drawConstants(g: CanvasRenderingContext2D, W: number, H: number, style: StyleParams, info: DayInfo, fonts: Fonts, captionAlpha = 1) {
  const m = LAYOUT.margin * W;
  const ink = style.palette.ink;
  g.save();
  g.textBaseline = 'alphabetic';

  // Шапка: дата и номер дня
  g.fillStyle = rgba(ink, 0.75);
  g.font = `500 ${LAYOUT.sizes.header}px ${fonts.mono}`;
  setSpacing(g, 4);
  const hy = LAYOUT.header.y * H + LAYOUT.sizes.header;
  g.textAlign = 'left';
  g.fillText(fmtDate(info.date), m, hy);
  g.textAlign = 'right';
  g.fillText(info.dayNumber ? `ДЕНЬ ${String(info.dayNumber).padStart(3, '0')}` : 'ДНЕВНИК', W - m, hy);
  g.fillStyle = rgba(ink, 0.25);
  g.fillRect(m, hy + 16, W - 2 * m, 1.5);
  setSpacing(g, 0);

  // Название
  g.textAlign = 'left';
  g.fillStyle = ink;
  let size = LAYOUT.sizes.title;
  let lines: string[];
  do {
    g.font = `${style.typography.titleWeight} ${size}px ${fonts.serif}`;
    lines = wrap(g, info.title, W - 2 * m);
    // Две строки должны поместиться над фото: уменьшаем кегль.
    if (lines.length === 1 || (lines.length === 2 && size <= 60)) break;
    size -= 4;
  } while (size > 44);
  const ty = LAYOUT.title.y * H + size * 0.95;
  lines.slice(0, 2).forEach((l, i) => g.fillText(l, m, ty + i * size * 1.02));

  // Рукописная подпись
  g.save();
  const cy = LAYOUT.caption.y * H + LAYOUT.sizes.caption;
  g.translate(m + 6, cy);
  g.rotate((style.typography.captionTilt * Math.PI) / 180);
  g.font = `500 ${LAYOUT.sizes.caption}px ${fonts.hand}`;
  g.fillStyle = rgba(ink, 0.88 * captionAlpha);   // подпись ложится в свою долю (B5)
  g.fillText(info.caption, 0, 0, W - 2 * m - 12);
  g.restore();

  // Нижняя строка
  g.font = `400 ${LAYOUT.sizes.footer}px ${fonts.mono}`;
  setSpacing(g, 2);
  g.fillStyle = rgba(ink, 0.5);
  const fy = LAYOUT.footer.y * H + LAYOUT.sizes.footer;
  const brand = 'ДНЕВНИК АТМОСФЕРЫ';
  // Песня занимает место слева до подписи бренда с зазором — длинное название обрезается, а не наезжает.
  const songMax = W - 2 * m - g.measureText(brand).width - LAYOUT.sizes.footer * 2;
  const songLine = fitSongLine((t) => g.measureText(t).width, info.songLabel, style.motion.bpm, songMax);
  g.textAlign = 'left';
  g.fillText(songLine, m, fy);
  g.textAlign = 'right';
  g.fillText(brand, W - m, fy);
  setSpacing(g, 0);
  g.restore();
}
