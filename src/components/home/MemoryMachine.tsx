'use client';
// «Машина воспоминаний» (ресерч 20.11, M1/N2): на главной по кругу показываем, что делает дневник.
// Запись печатается → фото ложатся полароидами → песня крутится пластинкой в своём BPM →
// воспоминание проявляется из размытия, как фото в ванночке → появляется папка дня. Потом следующий день.
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { TECHNIQUE_NAMES } from '@/lib/style/techniques';
import { demoDays } from './demoDays';

const MemoryCanvas = dynamic(() => import('@/render/MemoryCanvas'), { ssr: false });

const T_TYPE = 2300, T_PHOTOS = 3500, T_SONG = 4700, T_END = 12500;
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const subscribeReduced = (cb: () => void) => {
  const m = window.matchMedia('(prefers-reduced-motion: reduce)');
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};

export function MemoryMachine() {
  const days = useMemo(() => demoDays(), []);
  const [idx, setIdx] = useState(0);
  const [t, setT] = useState(0);
  const [visible, setVisible] = useState(true);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia('(prefers-reduced-motion: reduce)').matches, () => false);
  const box = useRef<HTMLDivElement>(null);
  const start = useRef(0);
  const restart = useRef(false);

  // Не тратим батарею, пока машина за экраном.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || reduced) return;
    start.current = performance.now() - t;
    const timer = setInterval(() => {
      if (restart.current) { start.current = performance.now(); restart.current = false; }
      const el = performance.now() - start.current;
      if (el >= T_END) { start.current = performance.now(); setT(0); setIdx((i) => (i + 1) % days.length); }
      else setT(el);
    }, 50);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduced, days.length]);

  const time = reduced ? T_END - 1 : t;
  const d = days[idx];
  const typed = d.text.slice(0, Math.round(d.text.length * clamp(time / T_TYPE)));
  const photosOn = time >= T_TYPE;
  const songOn = time >= T_PHOTOS;
  const develop = time >= T_SONG;
  const bpmShown = Math.round(d.bpm * clamp((time - T_PHOTOS) / 900));
  const folderTyped = d.folder.slice(0, Math.round(d.folder.length * clamp((time - T_SONG - 2600) / 1400)));
  const accent = d.style.palette.accents[0];

  function jump(i: number) { restart.current = true; setT(0); setIdx(i); }

  return (
    <div ref={box} className="relative w-full max-w-[600px]" aria-label="Как дневник превращает день в воспоминание">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-center gap-4 sm:gap-6">
        {/* Ввод: запись, фото, песня */}
        <div className="flex flex-col gap-3 transition-opacity duration-700" style={{ opacity: develop ? 0.55 : 1 }}>
          <div className="rounded-sm border border-foreground/15 bg-background/70 p-3 text-left shadow-sm backdrop-blur-sm">
            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted">запись дня</p>
            <p className="min-h-[5.5em] text-[15px] leading-snug sm:text-base">
              {typed}
              {time < T_TYPE + 400 && <span className="ml-px inline-block h-[1em] w-[2px] translate-y-[2px] bg-current" style={{ animation: 'caret 0.8s steps(1) infinite' }} />}
            </p>
          </div>
          <div className="relative h-[92px]">
            {photosOn && d.photos.slice(0, 3).map((src, i) => (
              <div key={`${d.name}-${i}`} className="absolute top-0 w-[38%] bg-[#fbf8f1] p-1 pb-3 shadow-md ring-1 ring-black/10"
                style={{ left: `${i * 29}%`, '--r': `${[-6, 3, -2][i]}deg`, '--fr': `${[25, -18, 30][i]}deg`, '--fx': `${[-40, 10, 50][i]}px`,
                  animation: `polaroid-in 0.6s cubic-bezier(0.2,0.8,0.2,1.15) ${i * 150}ms both` } as React.CSSProperties}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="aspect-square w-full object-cover" />
              </div>
            ))}
          </div>
          <div className="flex h-12 items-center gap-3 rounded-full border border-foreground/15 bg-background/70 py-1.5 pl-1.5 pr-4 backdrop-blur-sm transition-all duration-500"
            style={{ opacity: songOn ? 1 : 0.25 }}>
            <span className="relative h-9 w-9 shrink-0 rounded-full shadow"
              style={{ backgroundImage: `radial-gradient(circle, ${accent} 0 22%, transparent 23%), repeating-radial-gradient(circle, #151515 0 2px, #262626 2px 3px)`,
                animation: songOn ? `vinyl-spin ${(240 / d.bpm).toFixed(2)}s linear infinite` : undefined }} aria-hidden />
            <span className="min-w-0 truncate font-hand text-lg leading-none">♪ {d.song}</span>
            <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-muted">{songOn ? bpmShown : '—'} BPM</span>
          </div>
        </div>

        {/* Результат: воспоминание проявляется */}
        <div className="relative">
          <div className="pointer-events-none absolute -left-5 top-1/2 h-px w-5 sm:-left-6 sm:w-6" aria-hidden
            style={{ backgroundImage: 'linear-gradient(90deg, currentColor 50%, transparent 0)', backgroundSize: '6px 1px', opacity: develop ? 0.6 : 0.15, animation: 'arrow-flow 0.6s linear infinite' }} />
          <div className="overflow-hidden rounded-sm shadow-2xl ring-1 ring-black/10 transition-[filter,opacity,transform] duration-[1600ms] ease-out"
            style={{ opacity: develop ? 1 : 0.12, filter: develop ? 'blur(0) saturate(1)' : 'blur(18px) saturate(0.2)', transform: develop ? 'none' : 'scale(0.97)' }}>
            <MemoryCanvas key={d.name} style={d.style} photos={d.photos} playing={visible && develop && !reduced}
              info={{ title: d.title, caption: d.caption, date: d.date, songLabel: d.song, notes: d.notes }} />
          </div>
          <p className="mt-2 h-4 truncate font-mono text-[10px] text-muted">{folderTyped ? `📁 ${folderTyped}` : ''}</p>
          <p className="h-4 truncate font-mono text-[10px] text-muted transition-opacity duration-500" style={{ opacity: develop ? 1 : 0 }}>
            {TECHNIQUE_NAMES[d.style.techniques.primary]} · {d.moods.join(', ')}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2" role="tablist" aria-label="Демо-дни">
        {days.map((day, i) => (
          <button key={day.name} type="button" role="tab" aria-selected={i === idx} aria-label={day.title} onClick={() => jump(i)}
            className="group relative h-1.5 overflow-hidden rounded-full bg-foreground/15 transition-all duration-300" style={{ width: i === idx ? 40 : 14 }}>
            {i === idx && <span className="absolute inset-y-0 left-0 bg-foreground/70" style={{ width: `${clamp(time / T_END) * 100}%` }} />}
          </button>
        ))}
      </div>
    </div>
  );
}
