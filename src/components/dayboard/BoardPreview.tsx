'use client';
// Доска дня только для просмотра: всё, что человек положил руками, вписано в рамку целиком.
import { useEffect, useRef, useState } from 'react';
import { boardBox, fitInto, itemBox, type AnyItem } from '@/lib/dayboard/layout';
import { ItemFace } from './ItemFace';

export function BoardPreview({ items, urls, height = 420 }: { items: AnyItem[]; urls: Record<string, string>; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const box = boardBox(items);
  const fit = box && W ? fitInto(box, W, height) : null;
  // Рамки — под всем, рисунки и стрелки — поверх, как на доске-редакторе.
  const layer = (it: AnyItem) => (it.kind === 'frame' ? 0 : it.kind === 'stroke' || it.kind === 'arrow' ? 2 : 1);
  const list = [...items].sort((a, b) => layer(a) - layer(b));
  return (
    <div ref={wrap} className="relative w-full overflow-hidden rounded-lg bg-[#efe7da] ring-1 ring-black/5"
      style={{ height, backgroundImage: 'radial-gradient(rgba(43,36,28,.12) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
      {fit && (
        <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${fit.dx}px, ${fit.dy}px) scale(${fit.s})` }}>
          {list.map((it) => {
            const b = itemBox(it);
            const rot = Number((it as { rot?: number }).rot) || 0;
            const free = it.kind === 'stroke' || it.kind === 'arrow';
            return (
              <div key={it.id} className="absolute" style={{ left: b.x, top: b.y, width: b.w, minHeight: free ? undefined : b.h, transform: rot && !free ? `rotate(${rot}deg)` : undefined }}>
                <ItemFace it={it} urls={urls} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
