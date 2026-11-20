'use client';
// Атмосфера на всю страницу дня (ресерч 20.11, N5/M8): страница перетекает в цвета бумаги дня,
// а частицы его атмосферы (листья, снег, дождь, пылинки, огни) идут по всему экрану, а не только в кадре.
// Тот же генератор частиц, что и в воспоминании, — поэтому страница и кадр говорят одним языком.
import { useEffect, useRef } from 'react';
import type { StyleParams } from '@/lib/types';
import { createAtmosphere } from '@/render/atmosphere';
import { photoTime } from '@/render/timeline';
import type { RenderCtx } from '@/render/types';

const VARS = ['--background', '--foreground', '--muted'] as const;

export function PageAtmosphere({ style }: { style: StyleParams }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { bg, ink } = style.palette;
  const key = JSON.stringify([style.seed, style.atmosphere, style.palette, style.motion]);

  // Цвета страницы: фон — бумага дня, текст — его чернила (контраст обеспечивает движок палитры).
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--background', bg);
    root.setProperty('--foreground', ink);
    root.setProperty('--muted', `color-mix(in srgb, ${ink} 62%, ${bg})`);
    return () => VARS.forEach((v) => root.removeProperty(v));
  }, [bg, ink]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || style.atmosphere.kind === 'none') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    let raf = 0;
    let atm = createAtmosphere(style, 1, 1);
    let W = 0, H = 0;
    const resize = () => {
      const k = Math.min(window.devicePixelRatio || 1, 1.5);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * k); canvas.height = Math.round(H * k);
      g.setTransform(k, 0, 0, k, 0, 0);
      atm = createAtmosphere(style, W, H);
    };
    resize();
    const rc = { ctx: g, W, H, style, energy: () => 0.35 } as unknown as RenderCtx;
    const t0 = performance.now();
    const loop = () => {
      if (!document.hidden) {
        g.clearRect(0, 0, W, H);
        const t = (performance.now() - t0) / 1000;
        atm.draw({ ...rc, W, H }, photoTime(t, style.motion, 1));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (style.atmosphere.kind === 'none') return null;
  // Дождь и огни плотные — за текстом они должны быть тише, чем в кадре.
  const opacity = style.atmosphere.kind === 'rain' || style.atmosphere.kind === 'lights' ? 0.32 : 0.55;
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full" style={{ opacity, transition: 'opacity 2s ease' }} />;
}
