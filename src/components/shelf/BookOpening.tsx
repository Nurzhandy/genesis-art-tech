'use client';
// Открытие дневника со стола в три шага:
// 1) книга летит со стола к человеку и растёт;
// 2) обложка открывается в 3D, видна первая страница;
// 3) камера ныряет в первую страницу: линейки уходят, проступает сетка в точку, и страница
//    на весь экран становится полотном доски. Доска (?opened=1) продолжает этот наезд своей камерой.
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { DiaryMeta } from '@/lib/shelf';
import { DiaryCover } from './DiaryCover';

export interface OpeningFrom { meta: DiaryMeta; rect: DOMRect; example?: boolean }

const EASE = 'cubic-bezier(0.2,0.8,0.2,1)';
const BOARD_BG = '#f1ebe0';
const DOTS = 'radial-gradient(circle, rgba(43,36,28,0.16) 1px, transparent 1.4px)';

export function BookOpening({ from, onDone }: { from: OpeningFrom; onDone?: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const href = `/diary/${from.meta.id}/board?opened=1`;

  useEffect(() => {
    router.prefetch(href);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { router.push(href); return; }
    const timers = [
      setTimeout(() => setStep(1), 30),      // приближается
      setTimeout(() => setStep(2), 850),     // открывается обложка
      setTimeout(() => setStep(3), 1900),    // ныряем в первую страницу
      setTimeout(() => { router.push(href); onDone?.(); }, 2650),
    ];
    return () => timers.forEach(clearTimeout);
    // onDone меняется на каждом рендере стола — таймеры не перезапускаем.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, href]);

  const { rect } = from;
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
  const vw = typeof window === 'undefined' ? 1200 : window.innerWidth;
  const wide = vw > 700;
  // Книга близко: крупная, но раскрытый разворот (две страницы) всё ещё помещается в окно.
  const w = Math.min(vh * 0.8 * 0.75, wide ? vw * 0.45 : vw * 0.82);
  const h = w / 0.75;
  const left = vw / 2 - w / 2, top = vh / 2 - h / 2;
  const shift = step >= 2 && wide ? w / 2 : 0;   // разворот — по центру экрана

  const move = `left 0.8s ${EASE}, top 0.8s ${EASE}, width 0.8s ${EASE}, height 0.8s ${EASE}`;
  const book = step === 0
    ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    : { left: left + shift, top, width: w, height: h };
  // Первая страница лежит под обложкой; на шаге 3 она раскрывается на весь экран.
  const page = step === 3 ? { left: 0, top: 0, width: vw, height: vh } : book;

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden" aria-hidden>
      {/* Стол затемняется и уходит в бумагу доски */}
      <div className="absolute inset-0 transition-[opacity,background-color] duration-700"
        style={{ opacity: step === 0 ? 0 : 1, backgroundColor: step === 3 ? BOARD_BG : 'rgba(31,27,22,0.55)', backdropFilter: 'blur(3px)' }} />

      {/* Первая страница → полотно доски */}
      <div className="absolute overflow-hidden text-[#2b241c]"
        style={{
          ...page,
          backgroundColor: step === 3 ? BOARD_BG : '#f4efe6',
          borderRadius: step === 3 ? 0 : '0 6px 6px 0',
          boxShadow: step === 3 ? 'none' : '0 30px 60px -20px rgba(0,0,0,0.5)',
          transition: step === 3 ? `left 0.75s ${EASE}, top 0.75s ${EASE}, width 0.75s ${EASE}, height 0.75s ${EASE}, border-radius 0.75s, background-color 0.75s, box-shadow 0.5s` : move,
        }}>
        {/* Линейки дневника уходят, сетка в точку (как на доске) проступает */}
        <div className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: step === 3 ? 0 : 1, backgroundImage: 'repeating-linear-gradient(transparent 0 27px, rgba(43,36,28,0.08) 27px 28px)' }} />
        <div className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: step === 3 ? 1 : step === 2 ? 0.45 : 0, backgroundImage: DOTS, backgroundSize: '28px 28px' }} />
        <div className="absolute inset-0 flex flex-col justify-between p-[8%] transition-[opacity,transform] duration-500"
          style={{ opacity: step === 3 ? 0 : 1, transform: step === 3 ? 'scale(1.15)' : 'none' }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-60">дневник атмосферы</p>
          <div>
            <p className="font-hand text-4xl leading-tight">{from.meta.title}</p>
            <p className="mt-3 font-hand text-xl opacity-60 transition-opacity delay-300 duration-700" style={{ opacity: step >= 2 ? 0.6 : 0 }}>
              здесь можно всё: слова, фото, песни, рисунки…
            </p>
          </div>
          <p className="font-mono text-[10px] opacity-50">{from.meta.dayCount} · открываю…</p>
        </div>
      </div>

      {/* Обложка: открывается вокруг корешка, на шаге 3 пролетает мимо камеры */}
      <div className="absolute [perspective:1800px]"
        style={{
          ...book,
          opacity: step === 3 ? 0 : 1,
          transform: step === 3 ? 'scale(1.8)' : 'none',
          transformOrigin: 'left center',
          transition: `${move}, opacity 0.45s, transform 0.75s ${EASE}`,
        }}>
        <div className="absolute inset-0 origin-left [transform-style:preserve-3d]"
          style={{ transform: step >= 2 ? 'rotateY(-168deg)' : 'rotateY(0deg)', transition: 'transform 1s cubic-bezier(0.45,0.05,0.25,1)' }}>
          <div className="absolute inset-0 [backface-visibility:hidden]"
            style={{ boxShadow: step >= 1 ? '0 40px 80px -24px rgba(0,0,0,0.55)' : 'none', transition: 'box-shadow 0.8s' }}>
            <DiaryCover meta={from.meta} example={from.example} />
          </div>
          <div className="absolute inset-0 rounded-l-md bg-[#e9e0d0] shadow-inner [backface-visibility:hidden] [transform:rotateY(180deg)]"
            style={{ backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 60%)' }} />
        </div>
      </div>
    </div>
  );
}
