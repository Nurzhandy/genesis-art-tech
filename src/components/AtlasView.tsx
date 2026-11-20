'use client';
// «Атлас дней»: дневник как карта настроения (вдохновлено Atlas of Emotions и Dear Data).
// Каждый день — пятно в цветах своей палитры, дышит в темпе своей песни; нить соединяет дни по порядку.
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { humanDate } from '@/lib/archive';
import { atlasPoints, blobPath, chronological, type AtlasPoint } from '@/lib/atlas';
import type { DayRecord } from '@/lib/types';

const W = 1000, H = 640, PAD = 70;
const px = (p: AtlasPoint) => PAD + p.x * (W - 2 * PAD);
const py = (p: AtlasPoint) => H - PAD - p.y * (H - 2 * PAD);

// Подписи четвертей описывают дни, а не человека.
const QUARTERS = [
  { x: W - PAD - 10, y: PAD + 26, anchor: 'end', text: 'яркие дни' },
  { x: W - PAD - 10, y: H - PAD - 14, anchor: 'end', text: 'тёплая тишина' },
  { x: PAD + 10, y: PAD + 26, anchor: 'start', text: 'дни на нервах' },
  { x: PAD + 10, y: H - PAD - 14, anchor: 'start', text: 'пасмурные дни' },
] as const;

export function AtlasView({ days }: { days: DayRecord[] }) {
  const points = useMemo(() => atlasPoints(days), [days]);
  const thread = useMemo(() => chronological(points), [points]);
  const [active, setActive] = useState<AtlasPoint | null>(null);

  if (!points.length) {
    return <p className="py-16 text-center font-hand text-3xl text-muted">Атлас появится, когда в дневнике будет первый собранный день.</p>;
  }

  const path = thread.map((p, i) => `${i ? 'L' : 'M'}${px(p).toFixed(1)},${py(p).toFixed(1)}`).join(' ');

  return (
    <div className="relative">
      <p className="mb-4 max-w-2xl text-lg leading-relaxed text-muted">
        Каждое пятно — день вашего дневника. Чем правее, тем теплее; чем выше, тем живее. Пятно дышит в темпе песни
        того дня, а нить ведёт от первого дня к последнему.
      </p>
      <div className="relative overflow-hidden rounded-md border border-foreground/10">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="group" aria-label="Атлас дней: карта настроения дневника">
          <defs>
            {points.map((p) => (
              <radialGradient key={p.day.id} id={`atlas-g-${p.day.id}`} cx="40%" cy="38%" r="70%">
                <stop offset="0%" stopColor={p.color2} stopOpacity="0.95" />
                <stop offset="55%" stopColor={p.color} stopOpacity="0.85" />
                <stop offset="100%" stopColor={p.color} stopOpacity="0" />
              </radialGradient>
            ))}
            <filter id="atlas-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
          </defs>

          {/* Оси: тонкий крест посередине и слова на краях — без делений и цифр, это карта, а не график */}
          <g stroke="currentColor" strokeOpacity="0.14" strokeWidth="1">
            <line x1={W / 2} y1={PAD - 30} x2={W / 2} y2={H - PAD + 30} />
            <line x1={PAD - 30} y1={H / 2} x2={W - PAD + 30} y2={H / 2} />
          </g>
          <g className="fill-current" style={{ fontFamily: 'var(--font-caveat), cursive' }} fontSize="26" opacity="0.55">
            <text x={PAD - 40} y={H / 2 - 10}>холоднее</text>
            <text x={W - PAD + 40} y={H / 2 - 10} textAnchor="end">теплее</text>
            <text x={W / 2 + 12} y={PAD - 34}>живее</text>
            <text x={W / 2 + 12} y={H - PAD + 48}>спокойнее</text>
          </g>
          <g className="fill-current" style={{ fontFamily: 'var(--font-cormorant), serif' }} fontSize="20" fontStyle="italic" opacity="0.32">
            {QUARTERS.map((q) => <text key={q.text} x={q.x} y={q.y} textAnchor={q.anchor}>{q.text}</text>)}
          </g>

          {thread.length > 1 && <path d={path} fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.5" className="atlas-thread" />}

          {points.map((p) => {
            const r = 34 * p.r;
            const label = `${p.day.title ?? 'День'}, ${humanDate(p.day.date)}`;
            return (
              <Link key={p.day.id} href={`/day/${p.day.id}`} aria-label={label} className="atlas-day outline-none"
                onMouseEnter={() => setActive(p)} onMouseLeave={() => setActive((a) => (a === p ? null : a))}
                onFocus={() => setActive(p)} onBlur={() => setActive((a) => (a === p ? null : a))}>
                <g transform={`translate(${px(p).toFixed(1)} ${py(p).toFixed(1)})`}>
                  <path d={blobPath(p.day.id, r)} fill={`url(#atlas-g-${p.day.id})`} filter="url(#atlas-soft)"
                    className="atlas-blob" style={{ ['--beat' as string]: `${p.beatSec}s` }} />
                  <path d={blobPath(p.day.id, r * 0.62)} fill={p.color} fillOpacity="0.55" className="atlas-blob" style={{ ['--beat' as string]: `${p.beatSec}s`, animationDelay: `-${p.beatSec / 2}s` }} />
                  <circle r={r * 0.95} fill="none" stroke="currentColor" strokeWidth="1.5" className="atlas-ring opacity-0 transition-opacity" />
                  <circle r="3" className="fill-current" opacity="0.7" />
                </g>
              </Link>
            );
          })}
        </svg>

        {active && (
          <div className="pointer-events-none absolute max-w-[260px] -translate-x-1/2 rounded-md border border-foreground/15 bg-background/95 px-4 py-3 shadow-lg backdrop-blur"
            style={{ left: `${(px(active) / W) * 100}%`, top: `${(py(active) / H) * 100}%`, transform: `translate(-50%, ${active.y > 0.7 ? '24px' : 'calc(-100% - 24px)'})` }}>
            <p className="text-xl font-semibold leading-tight">{active.day.title}</p>
            <p className="mt-0.5 text-sm text-muted">{humanDate(active.day.date)}</p>
            {active.day.analysis?.caption && <p className="mt-1 font-hand text-xl leading-tight">«{active.day.analysis.caption}»</p>}
          </div>
        )}
      </div>
    </div>
  );
}
