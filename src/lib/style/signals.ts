// Нормализованные сигналы дня, из которых строятся все правила.
import type { StyleInput } from '@/lib/types';

export interface Signals {
  valence: number; arousal: number; tension: number; nostalgia: number;
  vPos: number; vNeg: number;
  warmLight: boolean;
  night: boolean;
  genre: string;
  year: number | null;
  minor: boolean;
  energy: number;
  bpm: number;
  photoCount: number;
}

export function signals(input: StyleInput): Signals {
  const { analysis: a, music, photos } = input;
  const { valence, arousal, tension, nostalgia } = a.mood;
  const scenes = a.photoScenes;
  const warmScenes = scenes.filter((s) => s.light === 'warm').length;
  const meanWarmth = photos.length ? photos.reduce((acc, p) => acc + p.warmth, 0) / photos.length : 0;
  const warmLight = scenes.length ? warmScenes / scenes.length >= 0.5 : meanWarmth > 0.3;
  const genre = (music.genre ?? a.songGuess?.genre ?? '').toLowerCase();
  const year = music.year ?? a.songGuess?.year ?? null;
  const mode = music.mode !== 'unknown' ? music.mode : a.songGuess?.mode ?? 'unknown';
  return {
    valence, arousal, tension, nostalgia,
    vPos: Math.max(valence, 0), vNeg: Math.max(-valence, 0),
    warmLight,
    night: a.timeOfDay === 'night',
    genre, year,
    minor: mode === 'minor',
    energy: music.energy,
    bpm: Math.min(200, Math.max(50, music.bpm || 90)),
    photoCount: Math.max(1, photos.length),
  };
}

export const genreIn = (genre: string, list: string[]) => list.some((g) => genre.includes(g));
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
