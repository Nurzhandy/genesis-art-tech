// Рецепты звуков дня (план 20.11, B4): процедурный звук под атмосферный слой, без чужих записей.
import type { AtmosphereKind } from '@/lib/types';

/** Общая громкость звуков дня относительно музыки. */
export const AMBIENT_LEVEL = 0.12;

export type Layer =
  | { type: 'noise'; color: 'white' | 'pink' | 'brown'; filter: BiquadFilterType; freq: number; q: number; gain: number; lfo?: { rate: number; depth: number } }
  | { type: 'drops'; perSec: number; freq: [number, number]; gain: number }
  | { type: 'crackle'; perSec: number; gain: number }
  | { type: 'hum'; freq: number; gain: number };

export interface Soundscape { label: string; layers: Layer[] }

const RECIPES: Record<AtmosphereKind, Soundscape> = {
  rain: { label: 'шум дождя и капли', layers: [
    { type: 'noise', color: 'pink', filter: 'lowpass', freq: 2200, q: 0.4, gain: 0.8 },
    { type: 'drops', perSec: 9, freq: [1800, 4200], gain: 0.35 },
  ] },
  snow: { label: 'тихий зимний ветер', layers: [
    { type: 'noise', color: 'brown', filter: 'bandpass', freq: 420, q: 0.6, gain: 0.7, lfo: { rate: 0.07, depth: 0.6 } },
  ] },
  leaves: { label: 'ветер и шорох листьев', layers: [
    { type: 'noise', color: 'pink', filter: 'bandpass', freq: 900, q: 0.5, gain: 0.55, lfo: { rate: 0.12, depth: 0.7 } },
    { type: 'noise', color: 'white', filter: 'highpass', freq: 5000, q: 0.7, gain: 0.18, lfo: { rate: 0.3, depth: 0.9 } },
  ] },
  mist: { label: 'тёплый низкий гул', layers: [
    { type: 'hum', freq: 82, gain: 0.35 },
    { type: 'noise', color: 'brown', filter: 'lowpass', freq: 300, q: 0.5, gain: 0.5 },
  ] },
  lights: { label: 'далёкий ночной город', layers: [
    { type: 'noise', color: 'brown', filter: 'lowpass', freq: 600, q: 0.3, gain: 0.7, lfo: { rate: 0.05, depth: 0.3 } },
    { type: 'hum', freq: 55, gain: 0.2 },
  ] },
  dust: { label: 'треск старой плёнки', layers: [
    { type: 'crackle', perSec: 14, gain: 0.5 },
    { type: 'noise', color: 'pink', filter: 'bandpass', freq: 3000, q: 1.2, gain: 0.08 },
  ] },
  none: { label: '', layers: [] },
};

export const soundscapeFor = (kind: AtmosphereKind): Soundscape => RECIPES[kind] ?? RECIPES.none;
