// Палитра дня: цвета фото, сдвинутые настроением, ладом и сезоном (B1).
import type { StyleInput, StyleParams } from '@/lib/types';
import { colorDistance, hexToOklch, mixHex, oklchToHex, rotateHueToward } from './color';
import { clamp01, round, signals } from './signals';

const SEASON_TINT: Record<string, string | null> = {
  autumn: '#c8892b', winter: '#7c8da6', spring: '#e8b4c0', summer: '#f2c14e', unknown: null,
};

const WARM_HUE = 60;
const COOL_HUE = 250;

/** Опорные цвета: палитры всех фото, взвешенные по доле, без близких дублей. */
function anchors(input: StyleInput, n = 6): string[] {
  const weighted: { hex: string; w: number }[] = [];
  for (const p of input.photos) p.palette.forEach((hex, i) => weighted.push({ hex: hex.toLowerCase(), w: 5 - i }));
  weighted.sort((a, b) => b.w - a.w);
  const out: string[] = [];
  for (const { hex } of weighted) {
    if (out.every((o) => colorDistance(o, hex) > 0.06)) out.push(hex);
    if (out.length === n) break;
  }
  if (out.length === 0) out.push(...moodAnchors(input));
  return out;
}

/**
 * День без фото: цвета берём из обложки песни, а если и её нет — из сезона и настроения текста,
 * чтобы страница не становилась серой.
 */
function moodAnchors(input: StyleInput): string[] {
  const cover = (input.music.coverPalette ?? []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).map((c) => c.toLowerCase());
  if (cover.length) return cover.slice(0, 4);
  const s = signals(input);
  const seasonHue: Record<string, number> = { autumn: 55, winter: 235, spring: 350, summer: 85, unknown: 30 };
  const h0 = seasonHue[input.analysis.season] ?? 30;
  const c = 0.06 + 0.08 * s.arousal;
  const l = s.valence >= 0 ? 0.68 : 0.52;
  return [0, 35, -40, 160].map((dh, i) => oklchToHex({ l: l - i * 0.05, c, h: (h0 + dh + 360) % 360 }));
}

export interface PaletteResult { palette: StyleParams['palette']; warmShift: number; coolShift: number; dark: boolean }

export function buildPalette(input: StyleInput): PaletteResult {
  const s = signals(input);
  // Поправка «теплее/холоднее» от человека двигает тон напрямую.
  const wx = input.weather;
  // Погода того дня: мороз холодит, жара греет, пасмурность приглушает.
  const warmShift = clamp01(0.25 * s.vPos + 0.15 * (s.warmLight ? 1 : 0) + Math.max(0, s.warmthOverride) + (wx && wx.tempC >= 25 ? 0.1 : 0));
  const coolShift = clamp01(0.3 * s.tension + 0.2 * (s.night ? 1 : 0) + Math.max(0, -s.warmthOverride) - Math.max(0, s.warmthOverride) * 0.5 + (wx && wx.tempC <= -5 ? 0.15 : 0));
  const chromaK = (0.55 + 0.45 * s.arousal) * (s.minor ? 0.75 : 1) * (wx && wx.cloudCover >= 80 ? 0.9 : 1);
  const tint = SEASON_TINT[input.analysis.season] ?? null;

  const shifted = anchors(input).map((hex) => {
    const c0 = hexToOklch(hex);
    let h = c0.h;
    if (c0.c > 0.01) {
      h = rotateHueToward(h, WARM_HUE, warmShift);
      h = rotateHueToward(h, COOL_HUE, coolShift);
    }
    let out = oklchToHex({ l: c0.l, c: c0.c * chromaK, h });
    if (tint) out = mixHex(out, tint, 0.15);
    return out;
  });

  // Фон — светлая бумага в обычные дни, тёмная — ночью и в напряжённые дни.
  const dark = s.tension > 0.6 || s.night;
  const dominant = hexToOklch(shifted[0]);
  const bgHue = dominant.c > 0.01 ? dominant.h : WARM_HUE;
  const bg = dark
    ? oklchToHex({ l: 0.2, c: 0.03, h: bgHue })
    : s.valence >= 0
      ? oklchToHex({ l: 0.94, c: 0.025, h: bgHue })
      : oklchToHex({ l: 0.88, c: 0.012, h: bgHue });
  const paper = oklchToHex({ l: hexToOklch(bg).l + (dark ? 0.04 : -0.04), c: 0.02, h: bgHue });
  const ink = dark ? oklchToHex({ l: 0.93, c: 0.02, h: bgHue }) : oklchToHex({ l: 0.22, c: 0.03, h: bgHue });

  // Акценты — сдвинутые цвета, достаточно отличные от фона; 12% — от обложки альбома.
  const cover = (input.music.coverPalette ?? []).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  const accents = shifted.filter((h) => colorDistance(h, bg) > 0.12).slice(0, 4)
    .map((h, i) => (cover.length ? mixHex(h, cover[i % cover.length].toLowerCase(), 0.12) : h));
  while (accents.length < 3) {
    const base = hexToOklch(accents[0] ?? shifted[0]);
    accents.push(oklchToHex({ l: dark ? 0.7 : 0.5, c: Math.max(0.06, base.c), h: (base.h + 40 * accents.length) % 360 }));
  }

  return { palette: { bg, paper, ink, accents }, warmShift: round(warmShift), coolShift: round(coolShift), dark };
}
