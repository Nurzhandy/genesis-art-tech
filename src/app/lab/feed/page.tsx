'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { FIXTURES } from '@/lib/fixtures';
import { buildStyle } from '@/lib/style/buildStyle';
import { TECHNIQUE_NAMES } from '@/lib/style/techniques';

const MemoryCanvas = dynamic(() => import('@/render/MemoryCanvas'), { ssr: false });

export default function LabFeed() {
  return (
    <main className="px-4 py-8">
      <div className="mx-auto mb-6 flex max-w-6xl items-end justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">проверка лентой</p>
          <h1 className="text-4xl font-semibold">Один дневник — разные дни</h1>
        </div>
        <Link href="/lab" className="font-mono text-xs underline">← лаборатория</Link>
      </div>
      <div className="flex snap-x gap-4 overflow-x-auto pb-4">
        {FIXTURES.map((f, i) => {
          const style = buildStyle(f.input);
          return (
            <figure key={f.name} className="w-[260px] shrink-0 snap-start sm:w-[300px]">
              <MemoryCanvas style={style} photos={f.photos} playing
                info={{ title: f.input.analysis.title, caption: f.input.analysis.caption, date: f.input.date, dayNumber: i + 1, songLabel: f.song }} className="rounded-sm shadow-lg" />
              <figcaption className="mt-2 font-mono text-[11px] text-muted">{TECHNIQUE_NAMES[style.techniques.primary]}{style.techniques.secondary ? ` + ${TECHNIQUE_NAMES[style.techniques.secondary]}` : ''}</figcaption>
            </figure>
          );
        })}
      </div>
    </main>
  );
}
