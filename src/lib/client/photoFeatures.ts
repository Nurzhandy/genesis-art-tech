// Признаки фото из пикселей: палитра (k-means в Lab), яркость, теплота, насыщенность (A4).
import type { PhotoFeatures } from '@/lib/types';

type Lab = [number, number, number];

const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);

function rgbToLab(r: number, g: number, b: number): Lab {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const dist2 = (a: Lab, b: Lab) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function computeFeatures(pixels: Uint8ClampedArray, width: number, height: number, index: number, k = 5): PhotoFeatures {
  const total = Math.floor(pixels.length / 4);
  const step = Math.max(1, Math.floor(total / 2000));
  const rgb: [number, number, number][] = [];
  const lab: Lab[] = [];
  let sumL = 0, sumWarm = 0, sumChroma = 0;
  for (let i = 0; i < total; i += step) {
    const o = i * 4;
    if (pixels[o + 3] < 128) continue;
    const c: [number, number, number] = [pixels[o], pixels[o + 1], pixels[o + 2]];
    const l = rgbToLab(...c);
    rgb.push(c); lab.push(l);
    sumL += l[0];
    sumWarm += (l[2] + 0.3 * l[1]) / 50;
    sumChroma += Math.hypot(l[1], l[2]);
  }
  const n = Math.max(1, lab.length);

  // k-means с детерминированной инициализацией (самые далёкие точки).
  const centers: Lab[] = [];
  if (lab.length) centers.push(lab[0]);
  while (centers.length < k && lab.length) {
    let best = -1, bestD = 0;
    for (let i = 0; i < lab.length; i++) {
      const d = Math.min(...centers.map((c) => dist2(c, lab[i])));
      if (d > bestD) { bestD = d; best = i; }
    }
    if (best < 0 || bestD < 4) break;
    centers.push(lab[best]);
  }
  const assign = new Array(lab.length).fill(0);
  for (let iter = 0; iter < 8; iter++) {
    for (let i = 0; i < lab.length; i++) {
      let bi = 0, bd = Infinity;
      centers.forEach((c, ci) => { const d = dist2(c, lab[i]); if (d < bd) { bd = d; bi = ci; } });
      assign[i] = bi;
    }
    centers.forEach((_, ci) => {
      let L = 0, A = 0, B = 0, cnt = 0;
      for (let i = 0; i < lab.length; i++) if (assign[i] === ci) { L += lab[i][0]; A += lab[i][1]; B += lab[i][2]; cnt++; }
      if (cnt) centers[ci] = [L / cnt, A / cnt, B / cnt];
    });
  }
  const clusters = centers.map((_, ci) => {
    let r = 0, g = 0, b = 0, cnt = 0;
    for (let i = 0; i < rgb.length; i++) if (assign[i] === ci) { r += rgb[i][0]; g += rgb[i][1]; b += rgb[i][2]; cnt++; }
    return { cnt, hex: cnt ? hex(r / cnt, g / cnt, b / cnt) : '' };
  }).filter((c) => c.cnt > 0).sort((a, b) => b.cnt - a.cnt);

  return {
    index, width, height,
    palette: clusters.length ? [...new Set(clusters.map((c) => c.hex))] : ['#808080'],
    brightness: Math.round(clamp(sumL / n / 100) * 1000) / 1000,
    warmth: Math.round(clamp(sumWarm / n, -1, 1) * 1000) / 1000,
    saturation: Math.round(clamp(sumChroma / n / 80) * 1000) / 1000,
  };
}
