'use client';
// Вход на сайт (новая концепция 20.11): на тёмный лист падает капля чернил, растекается — и открывает
// бумажный стол. Один раз за сеанс; при «уменьшить движение» не показываем.
import { useEffect, useState } from 'react';

/** Когда закончится заставка (performance.now) — стол ждёт её, прежде чем «ронять» дневники. */
export let introEndsAt = 0;
let decided: boolean | null = null;

export function EntryIntro() {
  const [stage, setStage] = useState<'hidden' | 'drop' | 'spread' | 'done'>('hidden');
  useEffect(() => {
    // Решение принимаем один раз на загрузку: React в разработке запускает эффект дважды.
    if (decided === null) {
      let seen = false;
      try { seen = sessionStorage.getItem('intro-seen') === '1'; sessionStorage.setItem('intro-seen', '1'); } catch { /* приватный режим */ }
      decided = !seen && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    if (!decided) return;
    introEndsAt = performance.now() + 1900;
    const t0 = setTimeout(() => setStage('drop'), 0);
    const t1 = setTimeout(() => setStage('spread'), 750);
    const t2 = setTimeout(() => setStage('done'), 2000);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); };
  }, []);
  if (stage === 'hidden' || stage === 'done') return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80]">
      {/* Тёмный лист с дырой, которая растёт из точки падения капли */}
      <div className="absolute inset-0 bg-[#14110d]"
        style={{ clipPath: stage === 'spread' ? 'circle(0% at 50% 50%)' : 'circle(150% at 50% 50%)', transition: 'clip-path 1.2s cubic-bezier(0.7,0,0.2,1)',
          WebkitMaskImage: stage === 'spread' ? 'radial-gradient(circle at 50% 50%, transparent 0, transparent 30%, #000 31%)' : undefined }} />
      {/* Капля */}
      <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 rounded-full bg-[#c8892b]"
        style={{ animation: stage === 'drop' ? 'ink-fall 0.75s cubic-bezier(0.5,0,0.9,0.4) both' : 'ink-splash 0.9s ease-out both' }} />
      <p className="absolute inset-x-0 top-[58%] text-center font-mono text-[11px] uppercase tracking-[0.4em] text-[#efe7da]/70"
        style={{ opacity: stage === 'drop' ? 1 : 0, transition: 'opacity 0.4s' }}>дневник атмосферы</p>
    </div>
  );
}
