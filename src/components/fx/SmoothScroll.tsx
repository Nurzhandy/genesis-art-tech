'use client';
// Плавная прокрутка (Lenis, darkroomengineering/lenis) для длинных страниц: лендинг, /home, страница дня.
// Не включаем на досках — там колесо приближает, а не прокручивает. При «уменьшить движение» — обычная прокрутка.
// Lenis крутится от тикера GSAP, поэтому ScrollTrigger видит каждый кадр прокрутки.
import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({
      lerp: 0.09, wheelMultiplier: 0.9, anchors: true,
      // Пока поверх страницы заставка или окно (html без прокрутки) — страница под ними стоит.
      virtualScroll: () => document.documentElement.style.overflow !== 'hidden',
    });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => { gsap.ticker.remove(tick); lenis.destroy(); };
  }, []);
  return null;
}
