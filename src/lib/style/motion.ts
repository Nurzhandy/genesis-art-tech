// Ритм воспоминания из музыки и настроения (B1).
import type { StyleInput, StyleParams } from '@/lib/types';
import { clamp01, round, signals } from './signals';

export function buildMotion(input: StyleInput, photoCount: number): Pick<StyleParams, 'motion' | 'durationSec'> {
  const s = signals(input);
  const beatsPerPhoto: 2 | 4 | 8 = s.arousal > 0.6 ? 2 : s.arousal > 0.3 ? 4 : 8;
  const interval = (beatsPerPhoto * 60) / s.bpm;
  const durationSec = round(Math.min(45, Math.max(20, interval * Math.max(1, photoCount) * 2)), 1);
  return {
    motion: {
      bpm: s.bpm,
      beatsPerPhoto,
      jitter: round(clamp01(0.1 + 0.6 * s.energy)),
      easing: s.tension > 0.5 ? 'sharp' : 'soft',
    },
    durationSec,
  };
}

/** Длительность одного кадра в секундах. */
export const photoInterval = (m: StyleParams['motion']) => (m.beatsPerPhoto * 60) / m.bpm;
