'use client';
// Наклон к курсору и блик по глянцу полароида (ресерч 20.11, M6). На тач-экранах не включается.
import { useRef } from 'react';

export function Tilt({ children, className = '', max = 8 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  function move(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${(x - 0.5) * max * 2}deg`);
    el.style.setProperty('--rx', `${(0.5 - y) * max * 2}deg`);
    el.style.setProperty('--sx', `${x * 100}%`);
    el.style.setProperty('--sy', `${y * 100}%`);
  }
  function leave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }
  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={`tilt relative ${className}`}>
      {children}
      <div className="tilt-shine pointer-events-none absolute inset-0 rounded-[inherit]" aria-hidden />
    </div>
  );
}
