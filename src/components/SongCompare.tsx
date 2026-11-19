'use client';
// «Те же фото, другая песня» (ресерч R5): один день, два холста, меняется только музыка.
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import type { Fixture } from '@/lib/fixtures';
import { buildStyle } from '@/lib/style/buildStyle';
import { MUSIC_PRESETS } from '@/lib/style/musicPresets';
import { TECHNIQUE_NAMES } from '@/lib/style/techniques';
import type { StyleParams } from '@/lib/types';

const MemoryCanvas = dynamic(() => import('@/render/MemoryCanvas'), { ssr: false });

function Reasons({ style }: { style: StyleParams }) {
  return (
    <ul className="mt-3 space-y-1.5 text-[15px] leading-snug">
      <li className="font-mono text-[11px] uppercase tracking-wider text-muted">
        {TECHNIQUE_NAMES[style.techniques.primary]}{style.techniques.secondary ? ` + ${TECHNIQUE_NAMES[style.techniques.secondary]}` : ''}
      </li>
      {style.reasons.filter((r) => r.param !== 'technique').map((r) => <li key={r.param}>{r.because}</li>)}
    </ul>
  );
}

export function SongCompare({ fixture, dayNumber }: { fixture: Fixture; dayNumber: number }) {
  const [preset, setPreset] = useState(MUSIC_PRESETS[1].id);
  const music = MUSIC_PRESETS.find((p) => p.id === preset)!;
  const original = useMemo(() => buildStyle(fixture.input), [fixture]);
  const changed = useMemo(() => buildStyle({ ...fixture.input, music: music.music }), [fixture, music]);
  const info = (song: string) => ({
    title: fixture.input.analysis.title, caption: fixture.input.analysis.caption, date: fixture.input.date,
    dayNumber, songLabel: song, notes: fixture.input.analysis.sensory,
  });

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-muted">своя песня · {fixture.song || 'без названия'}</p>
        <MemoryCanvas style={original} photos={fixture.photos} playing info={info(fixture.song)} className="rounded-sm shadow-xl" />
        <Reasons style={original} />
      </div>
      <div>
        <select value={preset} onChange={(e) => setPreset(e.target.value)}
          className="mb-2 w-full rounded-sm border border-foreground/30 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-[0.1em]">
          {MUSIC_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <MemoryCanvas style={changed} photos={fixture.photos} playing info={info(music.label.split(' · ')[0])} className="rounded-sm shadow-xl" />
        <Reasons style={changed} />
      </div>
    </div>
  );
}
