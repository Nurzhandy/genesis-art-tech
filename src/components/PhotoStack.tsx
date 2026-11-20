'use client';
// Исходные фото дня стопкой полароидов (план 20.11, C6): клик или свайп — следующая карточка.
import { useRef, useState } from 'react';
import { nextTop, stackOrder, swipeStep, tiltOf } from '@/lib/client/stack';
import type { DayRecord } from '@/lib/types';

export function PhotoStack({ day }: { day: DayRecord }) {
  const photos = day.photos.map((p) => p.url ?? p.thumbUrl).filter((u): u is string => !!u);
  const [top, setTop] = useState(0);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  if (photos.length === 0) return null;
  const go = (step: number) => { setTop((t) => nextTop(t, step, photos.length)); setDrag(0); };

  return (
    <section>
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">фото дня · {top + 1} из {photos.length}</p>
      <div className="relative mx-auto h-[340px] w-[260px] select-none touch-pan-y" role="group" aria-roledescription="стопка фото"
        aria-label={`Фото ${top + 1} из ${photos.length}. Стрелки влево и вправо листают.`} tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }}
        onPointerDown={(e) => { start.current = e.clientX; (e.target as Element).setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => { if (start.current !== null) setDrag(e.clientX - start.current); }}
        onPointerUp={(e) => {
          if (start.current === null) return;
          const step = swipeStep(e.clientX - start.current);
          start.current = null;
          go(step === 0 ? 1 : step);   // короткое касание — тоже следующая
        }}
        onPointerCancel={() => { start.current = null; setDrag(0); }}>
        {stackOrder(photos.length, top).reverse().map((i) => {
          const depth = (i - top + photos.length) % photos.length;
          const isTop = depth === 0;
          return (
            <figure key={i} className="absolute inset-0 cursor-grab bg-[#fbf8f1] p-3 pb-12 shadow-xl ring-1 ring-black/10 transition-transform duration-300 active:cursor-grabbing"
              style={{
                transform: `translate(${isTop ? drag : depth * 4}px, ${depth * 3}px) rotate(${tiltOf(i) + (isTop ? drag / 20 : 0)}deg)`,
                transitionDuration: isTop && drag ? '0ms' : undefined,
                zIndex: photos.length - depth,
              }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photos[i]} alt={`Фото ${i + 1} дня «${day.title}»`} draggable={false} className="h-full w-full object-cover" loading="lazy" />
              <figcaption className="absolute inset-x-3 bottom-3 truncate font-hand text-xl text-[#3b3226]">
                {day.analysis?.photoScenes.find((s) => s.index === i)?.subject ?? day.date.split('-').reverse().join('.')}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
