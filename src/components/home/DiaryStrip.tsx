'use client';
// «Один дневник — разные дни» на главной: постеры демо-дней кладут на стол по прокрутке (M5) и наклоняются к курсору (M6).
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { TECHNIQUE_NAMES } from '@/lib/style/techniques';
import { Tilt } from '@/components/fx/Tilt';
import { demoDays } from './demoDays';

const MemoryCanvas = dynamic(() => import('@/render/MemoryCanvas'), { ssr: false });

export function DiaryStrip() {
  const days = useMemo(() => demoDays(), []);
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
      {days.map((d, i) => (
        <figure key={d.name} className="reveal-tilt" style={{ '--tilt-from': `${[-7, 5, -4, 6, -5][i % 5]}deg` } as React.CSSProperties}>
          <Tilt className="rounded-sm shadow-xl">
            <MemoryCanvas style={d.style} photos={d.photos} playing={false}
              info={{ title: d.title, caption: d.caption, date: d.date, songLabel: d.song, notes: d.notes }} className="rounded-sm" />
          </Tilt>
          <figcaption className="mt-3">
            <p className="text-lg leading-tight">{d.title}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{TECHNIQUE_NAMES[d.style.techniques.primary]} · {d.bpm} BPM</p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
