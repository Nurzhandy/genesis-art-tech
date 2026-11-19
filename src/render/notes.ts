// Заметки на полях (ресерч R2): детали из записи рукописью вдоль полей, по одной на смену кадра.
import type { StyleParams } from '@/lib/types';
import { LAYOUT } from '@/lib/style/constants';
import { clamp, rgba } from './draw';
import { mulberry32, range } from './rng';
import type { PhotoTime } from './timeline';
import type { Fonts, Zone } from './types';

export interface NotePlace { x: number; y: number; angle: number; side: 'left' | 'right'; maxLen: number }

export function placeNotes(count: number, seed: number, W: number, _H: number, margin: number, zone: Zone, tiltDeg: number): NotePlace[] {
  const rand = mulberry32(seed * 61 + 29);
  const first: 'left' | 'right' = rand() > 0.5 ? 'left' : 'right';
  const perSide = Math.max(1, Math.ceil(count / 2));
  const seg = zone.h / perSide;
  return Array.from({ length: count }, (_, k) => {
    const side = k % 2 === 0 ? first : first === 'left' ? 'right' : 'left';
    const slot = Math.floor(k / 2);
    const y = zone.y + seg * (slot + 0.5) + range(rand, -0.15, 0.15) * seg;
    const x = side === 'left' ? (margin * W) / 2 : W - (margin * W) / 2;
    const deg = (side === 'left' ? -90 : 90) + tiltDeg + range(rand, -2, 2);
    return { x, y, angle: (deg * Math.PI) / 180, side, maxLen: seg * 0.85 };
  });
}

/** Прозрачность k-й заметки: появляется на k-й смене кадра за одну долю; на постере видны все. */
export function noteAlpha(k: number, pt: PhotoTime, motion: StyleParams['motion'], photoCount: number, all: boolean): number {
  if (all) return 1;
  const slot = pt.cycle * Math.max(1, photoCount) + pt.index;
  if (k < slot) return 1;
  if (k > slot) return 0;
  return clamp(pt.local * motion.beatsPerPhoto);
}

export function drawNotes(g: CanvasRenderingContext2D, notes: string[], places: NotePlace[], style: StyleParams, fonts: Fonts, pt: PhotoTime, photoCount: number, all: boolean) {
  g.save();
  g.font = `500 ${Math.round(LAYOUT.sizes.caption * 0.62)}px ${fonts.hand}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  notes.forEach((text, k) => {
    const a = noteAlpha(k, pt, style.motion, photoCount, all);
    if (a <= 0.001) return;
    const p = places[k];
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.angle);
    g.fillStyle = rgba(style.palette.ink, 0.82 * a);
    g.fillText(text, 0, 0, p.maxLen);
    g.restore();
  });
  g.restore();
}
