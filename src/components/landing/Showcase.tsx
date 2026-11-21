'use client';
// Живые иллюстрации для блоков лендинга. Каждая оживает, когда доскроллили до неё, и уважает
// «уменьшить движение» в системе: тогда сразу показываем финальный кадр.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

const noop = () => () => {};
import type { AnyItem } from '@/lib/dayboard/layout';
import { ItemFace } from '@/components/dayboard/ItemFace';

function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  // «Уменьшить движение» или старый браузер — сразу финальный кадр (на сервере — нет, чтобы не спорить при гидрации).
  const still = useSyncExternalStore(noop, () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window), () => false);
  useEffect(() => {
    const el = ref.current;
    if (!el || still) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [still]);
  return [ref, seen || still];
}

const appear = (on: boolean, i: number) => ({
  opacity: on ? 1 : 0,
  transform: on ? undefined : 'translateY(24px) scale(0.9)',
  transition: `opacity 600ms ease ${i * 140}ms, transform 700ms cubic-bezier(.2,.9,.3,1.2) ${i * 140}ms`,
});

// ── Доска дня: элементы ложатся на стол по одному ──
const URLS = { a: '/fixtures/autumn-park/01.jpg', b: '/fixtures/grandma-old-song/01.jpg' };
const BOARD: { it: AnyItem; left: string; top: string; w: number; rot: number }[] = [
  { it: { id: 'n', kind: 'note', x: 0, y: 0, rot: 0, text: 'Гуляли по парку, листья шуршали', w: 200, color: '#f6e7b4', font: 'hand' }, left: '4%', top: '8%', w: 200, rot: -3 },
  { it: { id: 'p', kind: 'photo', x: 0, y: 0, rot: 0, path: 'a', w: 170, ratio: 1.25, caption: 'парк' }, left: '42%', top: '2%', w: 170, rot: 4 },
  { it: { id: 'q', kind: 'photo', x: 0, y: 0, rot: 0, path: 'b', w: 150, ratio: 1.25 }, left: '70%', top: '24%', w: 150, rot: -5 },
  { it: { id: 's', kind: 'song', x: 0, y: 0, rot: 0, url: 'https://x.y', title: 'Autumn Leaves', size: 120 }, left: '8%', top: '48%', w: 120, rot: 0 },
  { it: { id: 'm', kind: 'mood', x: 0, y: 0, rot: 0, feelings: ['уют'], size: 96 }, left: '40%', top: '62%', w: 96, rot: 0 },
  { it: { id: 'k', kind: 'sticker', x: 0, y: 0, rot: 0, shape: 'leaf', size: 70, color: '#b5653a' }, left: '62%', top: '68%', w: 70, rot: 12 },
];

export function BoardDemo() {
  const [ref, on] = useInView<HTMLDivElement>();
  // Сцена рисуется в 560×420 и целиком масштабируется под ширину (на телефоне — меньше, но так же).
  const [s, setS] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setS(el.clientWidth / 560));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return (
    <div ref={ref} className="relative mx-auto aspect-[4/3] w-full max-w-[560px] overflow-hidden rounded-2xl bg-[#efe7da] shadow-2xl ring-1 ring-black/5"
      style={{ backgroundImage: 'radial-gradient(rgba(43,36,28,.12) 1px, transparent 1px)', backgroundSize: '22px 22px' }} role="img" aria-label="Пример доски дня">
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: 560, height: 420, transform: `scale(${s})` }}>
        {BOARD.map((b, i) => (
          <div key={b.it.id} className="absolute text-[#2b241c]" style={{ left: b.left, top: b.top, width: b.w, rotate: `${b.rot}deg`, ...appear(on, i) }}>
            <ItemFace it={b.it} urls={URLS} />
          </div>
        ))}
      </div>
      <span className="absolute bottom-4 right-4 rounded-full bg-[#2b241c] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[#f6f1e8] shadow-xl" style={appear(on, BOARD.length + 1)}>
        ✦ Собрать день
      </span>
    </div>
  );
}

// ── Песня меняет страницу: пластинка в темпе песни, полосы пульсируют ──
export function SongDemo() {
  const [ref, on] = useInView<HTMLDivElement>();
  const days = [{ bpm: 76, c: ['#c8892b', '#7a3b2e'], t: 'Осенний парк' }, { bpm: 128, c: ['#3d4b6b', '#e8574a'], t: 'Ночь перед сдачей' }];
  return (
    <div ref={ref} className="grid w-full max-w-[560px] grid-cols-2 gap-4">
      {days.map((d, i) => (
        <div key={d.t} className="flex flex-col items-center gap-3 rounded-2xl p-5 text-white shadow-xl" style={{ background: `linear-gradient(160deg, ${d.c[0]}, ${d.c[1]})`, ...appear(on, i) }}>
          <span className="relative grid h-28 w-28 place-items-center rounded-full shadow-2xl"
            style={{ background: 'repeating-radial-gradient(circle, #151311 0 2px, #22201c 2px 4px)', animation: on ? `vinyl-spin ${(60 / d.bpm) * 8}s linear infinite` : undefined }}>
            <span className="h-9 w-9 rounded-full" style={{ background: d.c[0] }} />
          </span>
          <div className="flex h-8 items-end gap-1" aria-hidden>
            {Array.from({ length: 9 }, (_, k) => (
              <span key={k} className="w-1.5 rounded-full bg-white/80"
                style={{ height: `${30 + ((k * 37) % 70)}%`, animation: on ? `atlas-breathe ${60 / d.bpm}s ease-in-out ${k * 0.07}s infinite alternate` : undefined }} />
            ))}
          </div>
          <p className="text-center font-hand text-2xl leading-none">{d.t}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-80">{d.bpm} BPM</p>
        </div>
      ))}
    </div>
  );
}

// ── В этот день год назад: полароиды раскрываются веером ──
export function OnThisDayDemo() {
  const [ref, on] = useInView<HTMLDivElement>();
  const cards = [
    { src: '/fixtures/autumn-park/02.jpg', y: '2025', rot: -10, x: -70 },
    { src: '/fixtures/grandma-old-song/02.jpg', y: '2024', rot: 8, x: 70 },
    { src: '/fixtures/autumn-park/03.jpg', y: '2026', rot: -1, x: 0 },
  ];
  return (
    <div ref={ref} className="relative mx-auto h-[320px] w-full max-w-[460px]">
      {cards.map((c, i) => (
        <figure key={c.y} className="absolute left-1/2 top-6 w-44 bg-[#fbf8f2] p-2 pb-8 shadow-2xl ring-1 ring-black/5 sm:w-52"
          style={{ transform: `translateX(calc(-50% + ${on ? c.x : 0}px)) rotate(${on ? c.rot : 0}deg)`, transition: `transform 900ms cubic-bezier(.2,.9,.3,1.1) ${i * 120}ms`, zIndex: i }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.src} alt="" className="aspect-square w-full object-cover" loading="lazy" />
          <figcaption className="absolute bottom-1.5 left-0 right-0 text-center font-hand text-xl text-[#2b241c]">21 ноября · {c.y}</figcaption>
        </figure>
      ))}
    </div>
  );
}

// ── Свой голос: волна, как в голосовых сообщениях ──
export function VoiceDemo() {
  const [ref, on] = useInView<HTMLDivElement>();
  const bars = Array.from({ length: 36 }, (_, i) => 0.25 + Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.37)) * 0.75);
  return (
    <div ref={ref} className="flex w-full max-w-[520px] items-center gap-4 rounded-full bg-background px-5 py-4 shadow-2xl ring-1 ring-foreground/10">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-foreground text-background">▶</span>
      <div className="flex h-12 min-w-0 flex-1 items-center gap-[3px]" aria-hidden>
        {bars.map((h, i) => (
          <span key={i} className="flex-1 rounded-full bg-foreground/70"
            style={{ height: `${on ? h * 100 : 8}%`, transition: `height 500ms ease ${i * 25}ms` }} />
        ))}
      </div>
      <span className="font-mono text-xs text-muted">0:42</span>
    </div>
  );
}
