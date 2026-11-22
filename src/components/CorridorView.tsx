'use client';
// «Коридор дней» (22.11): архив как прогулка по коридору фотолаборатории. Прокрутка — шаг вперёд,
// дни висят на стенах как отпечатки под тёплыми лампами, от первого дня к последнему.
// Когда проходишь мимо дня, тихо начинает звучать его песня (после одного нажатия — так требует браузер).
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { humanDate } from '@/lib/archive';
import type { DayRecord } from '@/lib/types';
import { songLabel } from './MemoryPlayer';

const SPACING = 520;     // шаг между днями по глубине, px
const START = 700;       // первый день — чуть впереди камеры
const PERSPECTIVE = 900;

/** Какой день сейчас ближе всего к зрителю (по положению камеры). */
export function nearestDay(cam: number, count: number): number {
  return Math.max(0, Math.min(count - 1, Math.round((cam - START + SPACING * 0.35) / SPACING)));
}

export function CorridorView({ days }: { days: DayRecord[] }) {
  const list = useMemo(() => [...days].filter((d) => !d.sealed && d.status === 'ready').sort((a, b) => a.date.localeCompare(b.date)), [days]);
  const wrap = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLAnchorElement | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [sound, setSound] = useState(false);
  const [narrow, setNarrow] = useState(false);
  // Ширина экрана без полосы прокрутки: 100vw её включает, и коридор давал горизонтальную прокрутку.
  const [sb, setSb] = useState(0);
  const audio = useRef<{ el: HTMLAudioElement; id: string } | null>(null);
  const depth = START + (list.length - 1) * SPACING + 200;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const on = () => { setNarrow(mq.matches); setSb(window.innerWidth - document.documentElement.clientWidth); };
    on();
    mq.addEventListener('change', on);
    window.addEventListener('resize', on);
    return () => { mq.removeEventListener('change', on); window.removeEventListener('resize', on); };
  }, []);

  // Камера идёт по коридору вместе с прокруткой: плавно догоняет её, дальние отпечатки тонут в темноте.
  useEffect(() => {
    let raf = 0;
    let cam = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = () => {
      const el = wrap.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const total = el.offsetHeight - window.innerHeight;
        const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
        const target = p * depth;
        cam = reduced ? target : cam + (target - cam) * 0.12;
        if (world.current) world.current.style.transform = `translateZ(${cam}px)`;
        cards.current.forEach((c, i) => {
          if (!c) return;
          const dz = START + i * SPACING - cam;          // > 0 — день ещё впереди
          const fog = Math.max(0, Math.min(1, 1 - (dz - 300) / 2200));
          c.style.opacity = dz < -260 ? '0' : String(fog);
          c.style.filter = `brightness(${0.35 + 0.65 * fog})`;
        });
        const n = nearestDay(cam, list.length);
        setCurrent((v) => (v === n ? v : n));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [depth, list.length]);

  // Песня дня, мимо которого проходишь: тихо нарастает, предыдущая стихает.
  useEffect(() => {
    if (!sound) return;
    const day = list[current];
    if (!day?.songUrl || audio.current?.id === day.id) return;
    const prev = audio.current;
    if (prev) fade(prev.el, 0, 700, () => prev.el.pause());
    const el = new Audio(day.songUrl);
    el.crossOrigin = 'anonymous';
    el.loop = true;
    el.volume = 0;
    audio.current = { el, id: day.id };
    void el.play().then(() => fade(el, 0.55, 1200)).catch(() => undefined);
  }, [current, sound, list]);
  useEffect(() => () => audio.current?.el.pause(), []);

  if (!list.length) return null;
  const half = narrow ? 150 : 430;   // полуширина коридора
  const cardW = narrow ? 150 : 250;
  const day = list[current];

  return (
    <section aria-label="Коридор дней" className="relative left-1/2" style={{ width: `calc(100vw - ${sb}px)`, marginLeft: `calc(-50vw + ${sb / 2}px)` }}>
      <div ref={wrap} style={{ height: `calc(100vh + ${list.length * 70}vh)` }}>
        <div className="sticky top-0 h-screen overflow-hidden bg-[#0b0806] text-[#f2e9dc]" style={{ perspective: `${PERSPECTIVE}px`, perspectiveOrigin: '50% 42%' }}>
          {/* Тёплый свет в конце коридора */}
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(30% 30% at 50% 42%, rgba(224,160,90,0.18), transparent 70%)' }} />
          <div ref={world} className="absolute left-1/2 top-[42%]" style={{ transformStyle: 'preserve-3d' }}>
            {/* Пол и стены коридора */}
            <div aria-hidden className="absolute" style={{ width: half * 2 + 200, height: depth + 1400, left: -(half + 100), top: 260, transform: `rotateX(90deg)`, transformOrigin: '50% 0', background: 'repeating-linear-gradient(0deg, rgba(242,233,220,0.05) 0 2px, transparent 2px 120px), linear-gradient(to bottom, #1a130e, #0b0806)' }} />
            {[-1, 1].map((side) => (
              <div key={side} aria-hidden className="absolute" style={{ width: depth + 1400, height: 900, top: -450, left: side * half, transform: `rotateY(${side * 90}deg)`, transformOrigin: '0 50%', background: 'linear-gradient(to right, #1c1510, #0b0806)' }} />
            ))}
            {list.map((d, i) => {
              const side = i % 2 ? 1 : -1;
              const z = -(START + i * SPACING);
              return (
                <Link key={d.id} href={`/day/${d.id}`} ref={(el) => { cards.current[i] = el; }}
                  className="group absolute block transition-[filter] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0b84d]"
                  style={{ width: cardW, left: side * (half - 30) - cardW / 2, top: -cardW * 0.95, transform: `translateZ(${z}px) rotateY(${-side * 52}deg)`, transformStyle: 'preserve-3d' }}>
                  {/* Лампа над отпечатком */}
                  <span aria-hidden className="absolute -top-16 left-1/2 h-16 w-px -translate-x-1/2 bg-[#f2e9dc]/20" />
                  <span aria-hidden className="absolute -top-20 left-1/2 h-40 w-[140%] -translate-x-1/2" style={{ background: `radial-gradient(50% 50% at 50% 30%, ${d.style?.palette.accents[0] ?? '#e0b84d'}55, transparent 70%)` }} />
                  <div className="relative bg-[#fbf8f1] p-2 pb-3 shadow-[0_30px_60px_rgba(0,0,0,0.6)] transition-transform duration-500 group-hover:-translate-y-2">
                    <div className="overflow-hidden" style={{ aspectRatio: '9 / 16', background: d.style?.palette.bg ?? '#e9e2d6' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {(d.posterUrl ?? d.photos[0]?.thumbUrl) && <img src={d.posterUrl ?? d.photos[0]?.thumbUrl} alt={d.title ?? ''} loading="lazy" className="h-full w-full object-cover" />}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Подпись дня, мимо которого идёшь */}
          <div className="pointer-events-none absolute inset-x-0 bottom-8 flex flex-col items-center gap-1 px-6 text-center">
            <p key={day.id} className="font-hand text-4xl leading-tight sm:text-5xl" style={{ animation: 'pop-in 0.5s ease-out both' }}>{day.title}</p>
            <p className="text-lg text-[#f2e9dc]/60">{humanDate(day.date)}{songLabel(day) ? ` · ♪ ${songLabel(day)}` : ''}</p>
          </div>
          <div className="absolute left-5 top-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => { if (sound) { audio.current?.el.pause(); audio.current = null; } setSound((v) => !v); }} aria-pressed={sound}
              className="rounded-full border border-[#f2e9dc]/30 bg-black/30 px-4 py-2 text-base backdrop-blur transition hover:bg-[#f2e9dc] hover:text-[#0b0806] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f2e9dc]">
              {sound ? '♪ Песни звучат' : '♪ Слушать песни дней'}
            </button>
            <span className="text-base text-[#f2e9dc]/50">Прокручивайте — вы идёте по коридору от первого дня к последнему</span>
          </div>
          <p className="absolute right-5 top-6 text-base text-[#f2e9dc]/50">{current + 1} / {list.length}</p>
        </div>
      </div>
    </section>
  );
}

function fade(el: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  const from = el.volume, t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    el.volume = from + (to - from) * k;
    if (k < 1) requestAnimationFrame(step); else done?.();
  };
  requestAnimationFrame(step);
}
