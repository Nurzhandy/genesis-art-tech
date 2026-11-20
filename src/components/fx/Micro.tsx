'use client';
// Микровзаимодействия на весь сайт (ресерч 20.11, M9): магнитные кнопки и чернильная клякса при нажатии.
// Делегирование событий: достаточно атрибутов data-magnetic / data-ink на элементе, без обёрток.
import { useEffect } from 'react';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Micro() {
  useEffect(() => {
    if (reduced()) return;
    const fine = window.matchMedia('(pointer: fine)').matches;
    let current: HTMLElement | null = null;

    const onMove = (e: PointerEvent) => {
      if (!fine) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>('[data-magnetic]') ?? null;
      if (current && current !== el) { current.style.transform = ''; current = null; }
      if (!el) return;
      current = el;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.transition = 'transform 0.18s ease-out';
      el.style.transform = `translate(${dx * 8}px, ${dy * 6}px)`;
    };
    const onLeave = () => { if (current) { current.style.transform = ''; current = null; } };

    const onDown = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>('[data-ink], [data-magnetic]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2.2;
      const ink = document.createElement('span');
      ink.className = 'ink-ripple';
      ink.style.cssText = `left:${e.clientX - r.left}px;top:${e.clientY - r.top}px;width:${size}px;height:${size}px`;
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.style.overflow = 'hidden';
      el.appendChild(ink);
      setTimeout(() => ink.remove(), 650);
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('pointerdown', onDown, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('pointerdown', onDown);
    };
  }, []);
  return null;
}
