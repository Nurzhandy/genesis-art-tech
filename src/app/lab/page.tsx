'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { SongCompare } from '@/components/SongCompare';
import { WhyPanel } from '@/components/WhyPanel';
import { FIXTURES } from '@/lib/fixtures';
import { buildStyle } from '@/lib/style/buildStyle';
import { TECHNIQUES, TECHNIQUE_NAMES } from '@/lib/style/techniques';
import type { StyleParams, Technique } from '@/lib/types';
import type { Engine } from '@/render/engine';
import { exportPoster } from '@/render/poster';

const MemoryCanvas = dynamic(() => import('@/render/MemoryCanvas'), { ssr: false });

type Num = { label: string; get: (s: StyleParams) => number; set: (s: StyleParams, v: number) => StyleParams; min: number; max: number; step: number };
const SLIDERS: Num[] = [
  { label: 'BPM', get: (s) => s.motion.bpm, set: (s, v) => ({ ...s, motion: { ...s.motion, bpm: v } }), min: 50, max: 200, step: 1 },
  { label: 'дрожание', get: (s) => s.motion.jitter, set: (s, v) => ({ ...s, motion: { ...s.motion, jitter: v } }), min: 0, max: 1, step: 0.01 },
  { label: 'зерно', get: (s) => s.texture.grain, set: (s, v) => ({ ...s, texture: { ...s.texture, grain: v } }), min: 0, max: 1, step: 0.01 },
  { label: 'мазок', get: (s) => s.texture.brush, set: (s, v) => ({ ...s, texture: { ...s.texture, brush: v } }), min: 0, max: 1, step: 0.01 },
  { label: 'пустота', get: (s) => s.composition.negativeSpace, set: (s, v) => ({ ...s, composition: { ...s.composition, negativeSpace: v, density: 1 - v } }), min: 0, max: 1, step: 0.01 },
  { label: 'асимметрия', get: (s) => s.composition.asymmetry, set: (s, v) => ({ ...s, composition: { ...s.composition, asymmetry: v } }), min: 0, max: 1, step: 0.01 },
];

export default function Lab() {
  const [fixture, setFixture] = useState(FIXTURES[0].name);
  const [overrides, setOverrides] = useState<StyleParams | null>(null);
  const [pageView, setPageView] = useState<'photo' | 'drawing'>('photo');
  const [tech, setTech] = useState<Technique | 'auto'>('auto');
  const [playing, setPlaying] = useState(true);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [mode, setMode] = useState<'tune' | 'songs'>('tune');
  const f = FIXTURES.find((x) => x.name === fixture)!;
  const ruled = useMemo(() => buildStyle(f.input), [f]);
  const style = overrides ?? ruled;

  const modeSwitch = (
    <div className="mb-6 inline-flex rounded-full border border-foreground/20 p-0.5 font-mono text-xs">
      {([['tune', 'настройка стиля'], ['songs', 'те же фото, другая песня']] as const).map(([m, label]) => (
        <button key={m} onClick={() => setMode(m)} className={`rounded-full px-3 py-1 ${mode === m ? 'bg-foreground text-background' : 'text-muted'}`}>{label}</button>
      ))}
    </div>
  );

  if (mode === 'songs') {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        {modeSwitch}
        <h1 className="mb-2 text-4xl font-semibold">Те же фото, другая песня</h1>
        <p className="mb-5 max-w-2xl text-lg text-muted">Запись и фото одни и те же — меняется только музыка. Темп, воздух, палитра, зерно и атмосфера следуют за песней.</p>
        <div className="mb-6 flex flex-wrap gap-2 font-mono text-xs">
          {FIXTURES.map((x) => (
            <button key={x.name} onClick={() => setFixture(x.name)}
              className={`rounded-full px-3 py-1.5 ${x.name === fixture ? 'bg-foreground text-background' : 'border border-foreground/30'}`}>{x.input.analysis.title}</button>
          ))}
        </div>
        <SongCompare fixture={f} dayNumber={FIXTURES.indexOf(f) + 1} />
      </main>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="lg:col-span-2">{modeSwitch}</div>
      <div>
        <div role="radiogroup" aria-label="Вид страницы" className="mb-3 inline-flex rounded-full border border-foreground/20 p-1">
          {([['photo', 'Фото'], ['drawing', 'Рисунок']] as const).map(([m, label]) => (
            <button key={m} type="button" role="radio" aria-checked={pageView === m} onClick={() => setPageView(m)}
              className={`rounded-full px-4 py-1 text-sm ${pageView === m ? 'bg-foreground text-background' : 'text-muted'}`}>{label}</button>
          ))}
        </div>
        <MemoryCanvas style={style} photos={f.photos} playing={playing} onReady={setEngine} mode={pageView}
          info={{ title: f.input.analysis.title, caption: f.input.analysis.caption, date: f.input.date, dayNumber: FIXTURES.indexOf(f) + 1, songLabel: f.song, notes: f.input.analysis.sensory }}
          overrideTechnique={tech === 'auto' ? undefined : { primary: tech, secondary: null }} className="rounded-sm shadow-xl" />
        <div className="mt-3 flex gap-2 font-mono text-xs">
          <button className="rounded-full border border-foreground/30 px-3 py-1.5" onClick={() => setPlaying((p) => !p)}>{playing ? '❚❚ пауза' : '▶ играть'}</button>
          <button className="rounded-full border border-foreground/30 px-3 py-1.5" disabled={!engine} onClick={async () => {
            if (!engine) return;
            const blob = await exportPoster(engine);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = `${fixture}.jpg`; a.click();
            if (playing) engine.play();
          }}>↓ постер</button>
          <Link className="rounded-full border border-foreground/30 px-3 py-1.5" href="/lab/feed">лента →</Link>
        </div>
      </div>
      <div className="space-y-6">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">лаборатория стиля</p>
          <h1 className="text-4xl font-semibold">Как настроение становится формой</h1>
        </header>
        <div className="flex flex-wrap gap-2 font-mono text-xs">
          {FIXTURES.map((x) => (
            <button key={x.name} onClick={() => { setFixture(x.name); setOverrides(null); setTech('auto'); }}
              className={`rounded-full px-3 py-1.5 ${x.name === fixture ? 'bg-foreground text-background' : 'border border-foreground/30'}`}>{x.input.analysis.title}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-xs">
          {(['auto', ...TECHNIQUES] as const).map((t) => (
            <button key={t} onClick={() => setTech(t)}
              className={`rounded-full px-3 py-1.5 ${t === tech ? 'bg-foreground text-background' : 'border border-foreground/30'}`}>{t === 'auto' ? 'по правилам' : TECHNIQUE_NAMES[t]}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {SLIDERS.map((s) => (
            <label key={s.label} className="font-mono text-xs">
              <span className="flex justify-between text-muted"><span>{s.label}</span><span>{Math.round(s.get(style) * 100) / 100}</span></span>
              <input type="range" className="w-full" min={s.min} max={s.max} step={s.step} value={s.get(style)}
                onChange={(e) => setOverrides(s.set(style, Number(e.target.value)))} />
            </label>
          ))}
        </div>
        {overrides && <button className="font-mono text-xs underline" onClick={() => setOverrides(null)}>сбросить к правилам</button>}
        <WhyPanel style={ruled} />
      </div>
    </main>
  );
}
