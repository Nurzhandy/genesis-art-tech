'use client';
// Мозаика года (ресерч 20.11, W2, по мотивам «Mosaic Zoom»): издалека год — одна картина из цветов дней,
// колесом или щипком приближаемся — и каждая клетка становится постером воспоминания. Щелчок открывает день.
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { DayRecord } from '@/lib/types';
import type { YearCell } from '@/lib/year';

const CW = 18, CH = 32, GAP = 3, LABEL = 34;          // клетка — пропорции постера 9:16
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const POSTER_FROM = 3.2;                               // с этого увеличения в клетках видны постеры

interface View { s: number; x: number; y: number }

export function YearMosaic({ grid, days }: { grid: YearCell[][]; days: DayRecord[] }) {
  const router = useRouter();
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ s: 1, x: 0, y: 0 });
  const target = useRef<View>({ s: 1, x: 0, y: 0 });
  const images = useRef(new Map<string, HTMLImageElement>());
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [zoom, setZoom] = useState(1);
  const byId = new Map(days.map((d) => [d.id, d]));
  const byIdRef = useRef(byId);
  useEffect(() => { byIdRef.current = byId; });

  const fullW = LABEL + 31 * (CW + GAP), fullH = 12 * (CH + GAP);

  // Вписываем год в ширину блока.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => {
      const s = Math.min((el.clientWidth - 4) / fullW, 1.6);
      view.current = { s, x: 0, y: 0 };
      target.current = { s, x: 0, y: 0 };
      setZoom(s);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fullW]);

  useEffect(() => {
    let raf = 0;
    const c = canvas.current!;
    const g = c.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const loop = () => {
      const el = wrap.current!;
      const w = el.clientWidth, h = Math.min(window.innerHeight * 0.7, Math.max(260, fullH * target.current.s + 20));
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
        c.style.width = `${w}px`; c.style.height = `${h}px`;
      }
      // Плавное приближение: текущий вид догоняет целевой.
      const v = view.current, t = target.current;
      v.s += (t.s - v.s) * 0.18; v.x += (t.x - v.x) * 0.18; v.y += (t.y - v.y) * 0.18;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      g.save();
      g.translate(v.x, v.y);
      g.scale(v.s, v.s);
      const fg = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim() || '#1f1b16';
      g.font = '500 11px monospace';
      g.fillStyle = fg;
      g.globalAlpha = 0.5;
      grid.forEach((_, m) => g.fillText(MONTHS[m], 0, m * (CH + GAP) + CH * 0.6));
      g.globalAlpha = 1;
      const showPosters = v.s >= POSTER_FROM;
      grid.forEach((row, m) => row.forEach((cell, d) => {
        if (!cell.inMonth) return;
        const x = LABEL + d * (CW + GAP), y = m * (CH + GAP);
        // Клетки за краем экрана не рисуем.
        const sx = v.x + x * v.s, sy = v.y + y * v.s;
        if (sx > w || sy > h || sx + CW * v.s < 0 || sy + CH * v.s < 0) return;
        if (!cell.dayId) {
          g.fillStyle = fg; g.globalAlpha = 0.06;
          g.fillRect(x, y, CW, CH);
          g.globalAlpha = 1;
          return;
        }
        g.fillStyle = cell.color ?? '#b9ad9c';
        g.fillRect(x, y, CW, CH);
        if (showPosters) {
          const day = byIdRef.current.get(cell.dayId);
          const src = day?.posterUrl ?? day?.photos[0]?.thumbUrl;
          if (src) {
            let img = images.current.get(src);
            if (!img) { img = new Image(); img.src = src; images.current.set(src, img); }
            if (img.complete && img.naturalWidth) {
              g.globalAlpha = Math.min(1, (v.s - POSTER_FROM) / 1.2 + 0.2);
              const k = Math.max(CW / img.naturalWidth, CH / img.naturalHeight);
              const iw = img.naturalWidth * k, ih = img.naturalHeight * k;
              g.save(); g.beginPath(); g.rect(x, y, CW, CH); g.clip();
              g.drawImage(img, x + (CW - iw) / 2, y + (CH - ih) / 2, iw, ih);
              g.restore();
              g.globalAlpha = 1;
            }
          }
        }
      }));
      g.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [grid, fullH]);

  // Колесо над мозаикой только приближает: слушатель не пассивный, чтобы страница не прокручивалась.
  const zoomRef = useRef<(px: number, py: number, k: number) => void>(() => undefined);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      zoomRef.current(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.18 : 1 / 1.18);
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, []);
  useEffect(() => { zoomRef.current = zoomAt; });

  function zoomAt(px: number, py: number, k: number) {
    const t = target.current;
    const minS = ((wrap.current?.clientWidth ?? fullW) - 4) / fullW;
    const s = Math.min(14, Math.max(minS, t.s * k));
    // Точка под курсором остаётся на месте.
    t.x = px - ((px - t.x) / t.s) * s;
    t.y = py - ((py - t.y) / t.s) * s;
    t.s = s;
    if (s <= minS + 0.001) { t.x = 0; t.y = 0; }
    setZoom(s);
  }

  function cellAt(px: number, py: number): YearCell | null {
    const v = view.current;
    const x = (px - v.x) / v.s - LABEL, y = (py - v.y) / v.s;
    const d = Math.floor(x / (CW + GAP)), m = Math.floor(y / (CH + GAP));
    return grid[m]?.[d] ?? null;
  }

  const pos = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div ref={wrap} className="relative select-none">
      <canvas ref={canvas} className="block cursor-zoom-in touch-none rounded-sm active:cursor-grabbing"
        aria-label="Мозаика года: колесо или щипок — приблизить, перетаскивание — сдвинуть, щелчок по дню — открыть"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { ...pos(e), moved: false }; }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const p = pos(e);
          if (Math.hypot(p.x - d.x, p.y - d.y) > 4) d.moved = true;
          if (d.moved) { target.current.x += p.x - d.x; target.current.y += p.y - d.y; view.current.x = target.current.x; view.current.y = target.current.y; d.x = p.x; d.y = p.y; }
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d?.moved) return;
          const p = pos(e);
          const cell = cellAt(p.x, p.y);
          if (cell?.dayId) router.push(`/day/${cell.dayId}`);
          else zoomAt(p.x, p.y, 2);   // по пустому месту — приблизить
        }}
        onDoubleClick={(e) => { const p = pos(e); zoomAt(p.x, p.y, 2.4); }} />
      <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted">
        <button type="button" className="rounded-full border border-foreground/20 px-3 py-1 hover:text-foreground"
          onClick={() => { const w = wrap.current?.clientWidth ?? 600; zoomAt(w / 2, 120, 2); }}>+ ближе</button>
        <button type="button" className="rounded-full border border-foreground/20 px-3 py-1 hover:text-foreground"
          onClick={() => { const minS = (wrap.current?.clientWidth ?? fullW) / fullW; target.current = { s: minS, x: 0, y: 0 }; setZoom(minS); }}>весь год</button>
        <span>{zoom < POSTER_FROM ? 'колесо или щипок — приблизить: в клетках появятся воспоминания' : 'перетаскивайте, щелчок по дню — открыть'}</span>
      </div>
    </div>
  );
}
