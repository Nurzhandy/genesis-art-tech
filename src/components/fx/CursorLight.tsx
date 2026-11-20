'use client';
// Свет от курсора, как фонарик над старыми страницами (ресерч 20.11, M4). Только для мыши.
import { useRef } from 'react';

export function CursorLight({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className={`group/light relative ${className}`}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse' || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        ref.current.style.setProperty('--mx', `${e.clientX - r.left}px`);
        ref.current.style.setProperty('--my', `${e.clientY - r.top}px`);
      }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover/light:opacity-100"
        style={{ background: 'radial-gradient(520px circle at var(--mx, 50%) var(--my, 30%), rgba(255, 214, 150, 0.16), transparent 60%)' }} />
      {children}
    </div>
  );
}
