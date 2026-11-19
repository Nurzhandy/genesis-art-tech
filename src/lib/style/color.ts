// Цветовые утилиты: hex ↔ OKLCH (Björn Ottosson), смешивание, контраст WCAG.

export interface Oklch { l: number; c: number; h: number }
interface Oklab { l: number; a: number; b: number }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`bad hex: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [number, number, number];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('');
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function rgbToOklab(rgb: [number, number, number]): Oklab {
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToRgb({ l, a, b }: Oklab): [number, number, number] {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map((v) => toGamma(clamp01(v))) as [number, number, number];
}

export function hexToOklch(hex: string): Oklch {
  const { l, a, b } = rgbToOklab(hexToRgb(hex));
  const c = Math.hypot(a, b);
  const h = c < 1e-4 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { l, c, h };
}

/** Перевод в hex; если цвет вне sRGB — уменьшаем chroma, пока не влезет. */
export function oklchToHex({ l, c, h }: Oklch): string {
  let chroma = Math.max(0, c);
  for (let i = 0; i < 24; i++) {
    const rad = (h * Math.PI) / 180;
    const lab = { l: clamp01(l), a: chroma * Math.cos(rad), b: chroma * Math.sin(rad) };
    const [r, g, b] = rawOklabToLinear(lab);
    if ([r, g, b].every((v) => v >= -1e-4 && v <= 1 + 1e-4)) return rgbToHex(oklabToRgb(lab));
    chroma *= 0.85;
  }
  return rgbToHex(oklabToRgb({ l: clamp01(l), a: 0, b: 0 }));
}

function rawOklabToLinear({ l, a, b }: Oklab): [number, number, number] {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

/** Смешивание в OKLab: t=0 → a, t=1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const A = rgbToOklab(hexToRgb(a));
  const B = rgbToOklab(hexToRgb(b));
  return rgbToHex(oklabToRgb({ l: A.l + (B.l - A.l) * t, a: A.a + (B.a - A.a) * t, b: A.b + (B.b - A.b) * t }));
}

/** Поворот тона к цели на долю t (по кратчайшей дуге). */
export function rotateHueToward(h: number, target: number, t: number): number {
  const d = ((target - h + 540) % 360) - 180;
  return (h + d * clamp01(t) + 360) % 360;
}

/** Расстояние между цветами в OKLab (≈ ΔE). */
export function colorDistance(a: string, b: string): number {
  const A = rgbToOklab(hexToRgb(a));
  const B = rgbToOklab(hexToRgb(b));
  return Math.hypot(A.l - B.l, A.a - B.a, A.b - B.b);
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
