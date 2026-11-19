// Время → какой кадр, где внутри кадра, как идёт переход, где доля (B2).
import type { StyleParams } from '@/lib/types';

export interface PhotoTime {
  index: number; prevIndex: number;
  local: number;        // 0..1 внутри кадра
  transition: number;   // 0..1 смены кадра (1 — завершена)
  beat: number;         // номер доли от начала
  beatPhase: number;    // 0..1 внутри доли
  cycle: number;        // номер круга по всем фото
  t: number;
}

const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

export function photoTime(t: number, motion: StyleParams['motion'], count: number): PhotoTime {
  const n = Math.max(1, count);
  const beatSec = 60 / motion.bpm;
  const interval = motion.beatsPerPhoto * beatSec;
  const slot = Math.floor(t / interval);
  const index = slot % n;
  const inSlot = t - slot * interval;
  const raw = Math.min(1, inSlot / beatSec);
  const eased = motion.easing === 'sharp' ? (raw >= 0.15 ? 1 : raw / 0.15) : easeInOutSine(raw);
  const beats = t / beatSec;
  return {
    index,
    prevIndex: (index - 1 + n) % n,
    local: inSlot / interval,
    transition: slot === 0 ? 1 : eased,
    beat: Math.floor(beats + 1e-9),
    beatPhase: beats - Math.floor(beats + 1e-9),
    cycle: Math.floor(slot / n),
    t,
  };
}

export const intervalSec = (m: StyleParams['motion']) => (m.beatsPerPhoto * 60) / m.bpm;
