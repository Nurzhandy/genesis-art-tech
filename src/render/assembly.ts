// Страница собирается на глазах (план 20.11, B5 / ресерч S3): элементы ложатся по одному в долю.
// Сборка длится столько долей, сколько держится кадр (2/4/8), в напряжённый день — рывками.
import type { StyleParams } from '@/lib/types';

export const ASSEMBLY_ORDER = ['photo', 'stamps', 'caption', 'song'] as const;
export type AssemblyPart = (typeof ASSEMBLY_ORDER)[number];

const smooth = (x: number) => x * x * (3 - 2 * x);

export function assemblyAt(t: number, motion: StyleParams['motion'], realtime: boolean): Record<AssemblyPart, number> {
  const out = {} as Record<AssemblyPart, number>;
  const beats = t / (60 / motion.bpm);
  const span = motion.beatsPerPhoto;           // за сколько долей собирается страница
  ASSEMBLY_ORDER.forEach((part, k) => {
    if (!realtime) { out[part] = 1; return; }
    const start = (k * span) / ASSEMBLY_ORDER.length;
    const x = Math.min(1, Math.max(0, beats - start));
    out[part] = motion.easing === 'sharp' ? (beats >= start && t > 0 ? 1 : 0) : smooth(x);
  });
  return out;
}
