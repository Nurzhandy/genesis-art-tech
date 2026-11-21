'use client';
// Капля настроения на доске дня (план 21.11, человек 2): чувства из трекера эмоций становятся живой каплей.
// Цвет — зоны выбранных чувств (до трёх: капля переливается между ними), форма медленно «дышит».
import { findFeeling, ZONES } from '@/lib/feelings';

/** Цвета капли по чувствам: зона каждого слова, без повторов; незнакомые слова — тёплая бумага. */
export function moodColors(feelings: string[]): string[] {
  const out: string[] = [];
  for (const w of feelings) {
    const z = findFeeling(w)?.zone;
    const c = z ? ZONES[z].color : '#c8892b';
    if (!out.includes(c)) out.push(c);
  }
  return out.length ? out : ['#c8892b'];
}

// Капля мягко дышит и меняет форму (свои keyframes, чтобы не трогать общий globals.css).
const BREATHE = `@keyframes mood-breathe {
  0% { border-radius: 58% 42% 55% 45% / 52% 60% 40% 48%; transform: scale(1); }
  50% { border-radius: 45% 55% 42% 58% / 60% 44% 56% 40%; transform: scale(1.04); }
  100% { border-radius: 52% 48% 60% 40% / 44% 54% 46% 56%; transform: scale(0.98); }
}`;

export function MoodDrop({ feelings, size }: { feelings: string[]; size: number }) {
  const cs = moodColors(feelings);
  const bg = cs.length === 1
    ? `radial-gradient(circle at 35% 30%, #ffffffaa 0 8%, transparent 30%), ${cs[0]}`
    : `radial-gradient(circle at 35% 30%, #ffffffaa 0 8%, transparent 30%), conic-gradient(from 210deg, ${[...cs, cs[0]].join(', ')})`;
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <style>{BREATHE}</style>
      <div className="shadow-xl" aria-hidden
        style={{ width: size, height: size, background: bg, borderRadius: '58% 42% 55% 45% / 52% 60% 40% 48%', animation: 'mood-breathe 7s ease-in-out infinite alternate' }} />
      <p className="mt-2 text-center font-hand text-xl leading-tight" style={{ width: size * 1.4 }}>{feelings.join(' · ')}</p>
    </div>
  );
}
