// «Атлас дней»: каждый день — живое пятно на карте настроения дневника.
// Оси те же, что у ползунков «Не совсем так?»: левее холоднее, правее теплее; ниже спокойнее, выше живее.
// Это карта записей, а не оценка человека: координаты — настроение текста, фото и песни того дня.
import type { DayRecord } from './types';

export interface AtlasPoint {
  day: DayRecord;
  x: number;        // 0..1, холоднее → теплее
  y: number;        // 0..1, спокойнее → живее
  r: number;        // относительный размер: больше фото — крупнее пятно
  color: string;
  color2: string;
  beatSec: number;  // период «дыхания» — четыре доли песни дня
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** Детерминированный генератор: у дня всегда одна и та же форма пятна. */
function rng(seed: number) {
  let a = seed || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function atlasPoints(days: DayRecord[]): AtlasPoint[] {
  return days
    .filter((d) => d.analysis?.mood && d.style)
    .map((d) => {
      const m = d.analysis!.mood;
      const o = d.moodOverride ?? { warmth: 0, energy: 0 };
      const rand = rng(hash(d.id));
      // Лёгкий сдвиг, чтобы одинаковые дни не легли друг на друга.
      const jx = (rand() - 0.5) * 0.04, jy = (rand() - 0.5) * 0.04;
      const accents = d.style!.palette.accents;
      return {
        day: d,
        x: clamp01((m.valence + o.warmth + 1) / 2 + jx),
        y: clamp01(m.arousal + o.energy + jy),
        r: 1 + 0.12 * Math.min(5, Math.max(1, d.photos.length)),
        color: accents[0] ?? d.style!.palette.ink,
        color2: accents[1] ?? accents[0] ?? d.style!.palette.bg,
        beatSec: Math.round((240 / Math.max(50, Math.min(200, d.style!.motion.bpm || 90))) * 100) / 100,
      };
    });
}

/** Органичная форма пятна вокруг (0,0): 8 «лепестков» разной длины, сглаженных кривыми. */
export function blobPath(id: string, radius: number): string {
  const rand = rng(hash(`blob:${id}`));
  const n = 8;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = radius * (0.78 + rand() * 0.38);
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  });
  const mid = (p: readonly [number, number], q: readonly [number, number]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as const;
  const f = (v: number) => Math.round(v * 10) / 10;
  const start = mid(pts[n - 1], pts[0]);
  let d = `M${f(start[0])},${f(start[1])}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = mid(pts[i], pts[(i + 1) % n]);
    d += ` Q${f(p[0])},${f(p[1])} ${f(q[0])},${f(q[1])}`;
  }
  return `${d} Z`;
}

/** Нить дней по порядку, как в «Today»: видно, как менялась погода внутри дневника. */
export function chronological(points: AtlasPoint[]): AtlasPoint[] {
  return [...points].sort((a, b) => (a.day.date === b.day.date ? a.day.createdAt.localeCompare(b.day.createdAt) : a.day.date < b.day.date ? -1 : 1));
}
