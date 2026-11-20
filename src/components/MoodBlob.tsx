'use client';
// Живая капля настроения (ресерч 20.11, W14, по мотивам How We Feel и Atlas of Emotions): вместо сухих ползунков
// поправку «Не совсем так?» можно задать, перетащив каплю. Тепло делает её янтарной и круглой, холод — синей,
// энергия — дрожащей и прыгучей. Это форма и цвет, а не оценка эмоций человека.
import { useEffect, useRef } from 'react';
import type { MoodOverride } from '@/lib/types';

const MAX = 0.4;
const SIZE = 220;
const N = 9;

const clamp = (v: number) => Math.max(-MAX, Math.min(MAX, Math.round(v * 20) / 20));

export function MoodBlob({ value, base, onChange }: { value: MoodOverride; base: string; onChange: (v: MoodOverride) => void }) {
  const path = useRef<SVGPathElement>(null);
  const group = useRef<SVGGElement>(null);
  const live = useRef(value);
  const dragging = useRef(false);
  useEffect(() => { live.current = value; }, [value]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const phases = Array.from({ length: N }, (_, i) => i * 1.7);
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      const t = reduced ? 0 : (performance.now() - t0) / 1000;
      const { warmth, energy } = live.current;
      const e = (energy + MAX) / (2 * MAX);                 // 0..1
      const w = (warmth + MAX) / (2 * MAX);
      const amp = 0.05 + 0.16 * e - 0.04 * w;               // тепло — круглее, энергия — неровнее
      const speed = 0.7 + 2.6 * e;
      const r = 34 + 6 * w;
      const pts = Array.from({ length: N }, (_, i) => {
        const a = (i / N) * Math.PI * 2;
        const k = 1 + amp * Math.sin(t * speed + phases[i]) + amp * 0.5 * Math.sin(t * speed * 1.7 + phases[i] * 2);
        return [Math.cos(a) * r * k, Math.sin(a) * r * k];
      });
      // Гладкий замкнутый контур через середины соседних точек.
      let d = '';
      for (let i = 0; i < N; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % N];
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        d += i === 0 ? `M${mx.toFixed(1)} ${my.toFixed(1)}` : '';
        const [nx, ny] = pts[(i + 1) % N], [mx2, my2] = [(nx + pts[(i + 2) % N][0]) / 2, (ny + pts[(i + 2) % N][1]) / 2];
        d += ` Q${nx.toFixed(1)} ${ny.toFixed(1)} ${mx2.toFixed(1)} ${my2.toFixed(1)}`;
      }
      path.current?.setAttribute('d', `${d} Z`);
      const cx = SIZE / 2 + (warmth / MAX) * (SIZE / 2 - 46);
      const cy = SIZE / 2 - (energy / MAX) * (SIZE / 2 - 46) - (reduced ? 0 : Math.abs(Math.sin(t * speed * 0.9)) * 10 * e);
      group.current?.setAttribute('transform', `translate(${cx.toFixed(1)} ${cy.toFixed(1)})`);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  function setFrom(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * SIZE, y = ((e.clientY - r.top) / r.height) * SIZE;
    onChange({ warmth: clamp(((x - SIZE / 2) / (SIZE / 2 - 46)) * MAX), energy: clamp(((SIZE / 2 - y) / (SIZE / 2 - 46)) * MAX) });
  }

  const warmMix = Math.round(((value.warmth + MAX) / (2 * MAX)) * 100);
  const fill = `color-mix(in oklab, color-mix(in oklab, #4f7fb8 ${100 - warmMix}%, #e0952f) 55%, ${base})`;

  return (
    <div className="flex justify-center">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="slider" tabIndex={0}
        aria-label="Капля настроения: влево — холоднее, вправо — теплее, вверх — живее, вниз — спокойнее"
        aria-valuetext={`тепло ${value.warmth}, энергия ${value.energy}`}
        className="cursor-grab touch-none rounded-md border border-foreground/10 active:cursor-grabbing"
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); setFrom(e); }}
        onPointerMove={(e) => { if (dragging.current) setFrom(e); }}
        onPointerUp={() => { dragging.current = false; }}
        onKeyDown={(e) => {
          const step = 0.05;
          const k: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
          if (!k[e.key]) return;
          e.preventDefault();
          onChange({ warmth: clamp(value.warmth + k[e.key][0]), energy: clamp(value.energy + k[e.key][1]) });
        }}>
        <line x1={SIZE / 2} y1={12} x2={SIZE / 2} y2={SIZE - 12} stroke="currentColor" strokeOpacity={0.12} strokeDasharray="3 5" />
        <line x1={12} y1={SIZE / 2} x2={SIZE - 12} y2={SIZE / 2} stroke="currentColor" strokeOpacity={0.12} strokeDasharray="3 5" />
        <text x={SIZE / 2} y={20} textAnchor="middle" className="fill-current font-mono text-[9px] opacity-50">живее</text>
        <text x={SIZE / 2} y={SIZE - 10} textAnchor="middle" className="fill-current font-mono text-[9px] opacity-50">спокойнее</text>
        <text x={10} y={SIZE / 2 - 6} className="fill-current font-mono text-[9px] opacity-50">холоднее</text>
        <text x={SIZE - 10} y={SIZE / 2 - 6} textAnchor="end" className="fill-current font-mono text-[9px] opacity-50">теплее</text>
        <g ref={group}>
          <path ref={path} fill={fill} style={{ filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.25))', transition: 'fill 0.4s' }} />
          <ellipse cx={-10} cy={-12} rx={9} ry={5} fill="#fff" opacity={0.35} />
        </g>
      </svg>
    </div>
  );
}
