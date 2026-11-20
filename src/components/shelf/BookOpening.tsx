'use client';
// Открытие дневника со стола (по мотивам роликов «Our Story»): книга взлетает в центр, обложка в 3D
// открывается, стол темнеет — и мы уже на странице-книге, на первом развороте.
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { DiaryMeta } from '@/lib/shelf';
import { DiaryCover } from './DiaryCover';

export interface OpeningFrom { meta: DiaryMeta; rect: DOMRect; example?: boolean }

export function BookOpening({ from, onDone }: { from: OpeningFrom; onDone?: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const href = `/diary/${from.meta.id}/book?opened=1`;

  useEffect(() => {
    router.prefetch(href);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { router.push(href); return; }
    const t1 = setTimeout(() => setStep(1), 30);
    const t2 = setTimeout(() => setStep(2), 700);
    const t3 = setTimeout(() => { router.push(href); onDone?.(); }, 1650);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [router, href, onDone]);

  const { rect } = from;
  // Куда летит книга: по центру экрана, в высоту ~72% окна; при открытии сдвигается вправо, чтобы разворот был по центру.
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
  const vw = typeof window === 'undefined' ? 1200 : window.innerWidth;
  const h = Math.min(vh * 0.72, 680);
  const w = h * 0.75;
  const target = { left: vw / 2 - w / 2, top: vh / 2 - h / 2 + 20 };
  const box = step === 0
    ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height, transform: 'rotate(0deg)' }
    : { left: target.left, top: target.top, width: w, height: h, transform: step === 2 && vw > 700 ? `translateX(${w / 2}px)` : 'none' };

  return (
    <div className="fixed inset-0 z-[70]" aria-hidden>
      <div className="absolute inset-0 bg-[#14110d] transition-opacity duration-700" style={{ opacity: step === 0 ? 0 : 1 }} />
      <div className="absolute [perspective:1800px]"
        style={{ ...box, transition: 'left 0.65s cubic-bezier(0.2,0.8,0.2,1), top 0.65s cubic-bezier(0.2,0.8,0.2,1), width 0.65s cubic-bezier(0.2,0.8,0.2,1), height 0.65s cubic-bezier(0.2,0.8,0.2,1), transform 0.9s cubic-bezier(0.3,0.7,0.2,1)' }}>
        {/* Первая страница под обложкой */}
        <div className="absolute inset-0 flex flex-col justify-between rounded-r-md bg-[#f4efe6] p-[8%] text-[#2b241c] shadow-2xl"
          style={{ backgroundImage: 'repeating-linear-gradient(transparent 0 27px, rgba(43,36,28,0.08) 27px 28px)' }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-60">дневник атмосферы</p>
          <p className="font-hand text-3xl leading-tight">{from.meta.title}</p>
          <p className="font-mono text-[10px] opacity-50">{from.meta.dayCount} · открываю…</p>
        </div>
        {/* Обложка: открывается вокруг корешка */}
        <div className="absolute inset-0 origin-left [transform-style:preserve-3d]"
          style={{ transform: step === 2 ? 'rotateY(-168deg)' : 'rotateY(0deg)', transition: 'transform 0.9s cubic-bezier(0.45,0.05,0.25,1)' }}>
          <div className="absolute inset-0 [backface-visibility:hidden]"><DiaryCover meta={from.meta} example={from.example} /></div>
          <div className="absolute inset-0 rounded-l-md bg-[#e9e0d0] shadow-inner [backface-visibility:hidden] [transform:rotateY(180deg)]"
            style={{ backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 60%)' }} />
        </div>
      </div>
    </div>
  );
}
