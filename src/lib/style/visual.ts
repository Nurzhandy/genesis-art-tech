// Правила «живого кадра» (план B11): люди, ритм песни, свет часа, ветер, возраст дня.
// Каждое решение — с причиной для «Почему так». Рисование — в src/render (photoFirst, engine, glass).
import type { StyleInput, StyleReason } from '@/lib/types';
import { clamp01, round, signals } from './signals';
import { parseFeelings, ZONES } from '@/lib/feelings';

export interface VisualParams {
  /** V8: людей на фото прописываем чётко, фон уходит в технику (доля фото в фоне). */
  portrait: { focusPeople: boolean; backdrop: number; sticker: boolean };
  /** V2: бас «дышит» кадром (±доля масштаба), удар даёт вспышку зерна/цвета. */
  rhythm: { breath: number; flash: number };
  /** V4: свет того часа — оттенок поверх фото и ореол самой яркой точки. */
  light: { kind: 'golden' | 'blue' | 'overcast' | 'night' | 'day'; tint: string; strength: number; glow: number };
  /** V11: ветер — куда дует в координатах холста (рад: 0 — вправо, π/2 — вниз) и сила 0..1. */
  wind: { angle: number; strength: number };
}

export const DEFAULT_VISUAL: VisualParams = {
  portrait: { focusPeople: false, backdrop: 1, sticker: false },
  rhythm: { breath: 0.008, flash: 0.04 },
  light: { kind: 'day', tint: '#ffffff', strength: 0, glow: 0 },
  wind: { angle: Math.PI / 2, strength: 0 },
};

const LIGHT = {
  golden: { tint: '#ffb35c', why: 'золотой час: тёплый низкий свет' },
  blue: { tint: '#5b7cff', why: 'синий час: холодный рассеянный свет' },
  overcast: { tint: '#9aa3ad', why: 'пасмурно: свет мягкий и серый' },
  night: { tint: '#ff9a3c', why: 'ночь: натриевые фонари дают оранжевый ореол' },
  day: { tint: '#ffffff', why: '' },
} as const;

export function buildVisual(input: StyleInput): { visual: VisualParams; reasons: StyleReason[] } {
  const s = signals(input);
  const a = input.analysis;
  const reasons: StyleReason[] = [];

  // V8 — люди на фото.
  const focusPeople = a.people === 'alone' || a.people === 'pair' || a.people === 'group';
  const portrait = { focusPeople, backdrop: focusPeople ? 0.38 : 1, sticker: focusPeople };
  if (focusPeople) reasons.push({ param: 'portrait', because: `На фото ${a.people === 'alone' ? 'человек' : a.people === 'pair' ? 'двое' : 'компания'} → люди прописаны чётко, фон уходит во впечатление (фон ${Math.round(portrait.backdrop * 100)}% фото)` });

  // V2 — ритм песни.
  const rhythm = { breath: round(0.006 + 0.012 * s.energy, 4), flash: round(0.03 + 0.09 * s.energy, 3) };
  reasons.push({ param: 'rhythm', because: `Бас песни (энергия ${round(s.energy, 2)}) → кадр дышит на ±${round(rhythm.breath * 100, 1)}%, на ударах — вспышка ${Math.round(rhythm.flash * 100)}%` });

  // V4 — свет того часа (+ облачность, если знаем погоду).
  const cloud = input.weather?.cloudCover ?? null;
  let kind: VisualParams['light']['kind'] = 'day';
  if (cloud !== null && cloud >= 75 && a.timeOfDay !== 'night') kind = 'overcast';
  else if (a.timeOfDay === 'evening' && s.warmLight) kind = 'golden';
  else if (a.timeOfDay === 'evening' || (a.timeOfDay === 'morning' && !s.warmLight)) kind = 'blue';
  else if (a.timeOfDay === 'night') kind = 'night';
  else if (a.timeOfDay === 'morning' && s.warmLight) kind = 'golden';
  const strength = kind === 'day' ? 0 : kind === 'overcast' ? 0.16 : 0.22;
  const light = { kind, tint: LIGHT[kind].tint, strength, glow: kind === 'golden' || kind === 'night' ? 0.35 : kind === 'day' && s.warmLight ? 0.15 : 0 };
  if (kind !== 'day') reasons.push({ param: 'light', because: `${LIGHT[kind].why}${cloud !== null ? ` (облачность ${Math.round(cloud)}%)` : ''} → оттенок ${Math.round(strength * 100)}% поверх фото` });

  // V11 — ветер (если пришёл с погодой), иначе тихо.
  const ms = input.weather?.windMs ?? null;
  const deg = input.weather?.windDeg ?? 270;
  const wind = ms !== null && ms > 0.5
    // Ветер «с запада» дует на восток: (откуда + 180°), а компас (0° — север, по часовой) → холст (0 — вправо).
    ? { angle: round(((((deg + 180) % 360) - 90) * Math.PI) / 180, 4), strength: round(clamp01(ms / 12), 3) }
    : DEFAULT_VISUAL.wind;
  if (ms !== null && ms > 0.5) reasons.push({ param: 'wind', because: `Ветер ${round(ms, 1)} м/с ${compass(deg)} → мазки и осадки сносит по ветру, сила ${Math.round(wind.strength * 100)}%` });

  // Трекер эмоций: слово человека — первая строка «Почему так».
  const fs = parseFeelings(input.feeling);
  if (fs.length) reasons.unshift({ param: 'feeling', because: `Вы отметили ${fs.map((f) => `«${f.word}» (${ZONES[f.zone].title.toLowerCase()})`).join(' и ')} → настроение записи сдвинуто к ${fs.length > 1 ? 'их смеси' : 'нему'} на 60%: радость ${round(a.mood.valence, 2)}, энергия ${round(a.mood.arousal, 2)}` });
  return { visual: { portrait, rhythm, light, wind }, reasons };
}

function compass(deg: number): string {
  const names = ['с севера', 'с северо-востока', 'с востока', 'с юго-востока', 'с юга', 'с юго-запада', 'с запада', 'с северо-запада'];
  return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

// ── V6: память стареет (считается в момент просмотра: зависит от «сегодня») ──
export interface AgeEffect { years: number; desat: number; grain: number; vignette: number; edgeBlur: number }

export function ageEffect(date: string, today: string): AgeEffect {
  const ms = Date.parse(`${today}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`);
  const years = Number.isFinite(ms) ? Math.max(0, ms / (365.25 * 24 * 3600 * 1000)) : 0;
  const k = clamp01(years / 3);   // за 3 года — максимум
  return { years: round(years, 2), desat: round(0.35 * k, 3), grain: round(0.25 * k, 3), vignette: round(0.25 * k, 3), edgeBlur: round(6 * k, 2) };
}

export function ageReason(e: AgeEffect): StyleReason | null {
  if (e.years < 0.08) return null;
  const age = e.years < 1 ? `${Math.max(1, Math.round(e.years * 12))} мес.` : `${round(e.years, 1)} г.`;
  return { param: 'age', because: `Дню ${age} → цвета выцвели на ${Math.round(e.desat * 100)}%, больше зерна, края мягче; центр остаётся чётким` };
}
