'use client';
// «Не совсем так?» (ресерч R10): человек поправляет настроение, стиль пересчитывается без AI.
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { MoodBlob } from './MoodBlob';
import type { DayRecord, MoodOverride } from '@/lib/types';

export function MoodTuner({ day, value, onChange, onSaved }: {
  day: DayRecord;
  value: MoodOverride | null;
  onChange: (v: MoodOverride | null) => void;
  onSaved: (d: DayRecord) => void;
}) {
  const [open, setOpen] = useState(Boolean(day.moodOverride));
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const v = value ?? { warmth: 0, energy: 0 };
  const changed = JSON.stringify(value ?? null) !== JSON.stringify(day.moodOverride ?? null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start font-mono text-xs uppercase tracking-wider text-muted underline-offset-4 hover:text-foreground hover:underline">
        Не совсем так? Поправить настроение
      </button>
    );
  }

  const slider = (key: keyof MoodOverride, left: string, right: string) => (
    <label className="block font-mono text-xs">
      <span className="flex justify-between text-muted"><span>{left}</span><span>{right}</span></span>
      <input type="range" min={-0.4} max={0.4} step={0.05} value={v[key]} className="w-full"
        onChange={(e) => { setState('idle'); onChange({ ...v, [key]: Number(e.target.value) }); }} />
    </label>
  );

  return (
    <section className="rounded-sm border border-foreground/15 p-5">
      <h2 className="mb-1 font-mono text-xs uppercase tracking-[0.2em] text-muted">Не совсем так?</h2>
      <p className="mb-4 text-sm text-muted">Перетащите каплю или сдвиньте ползунки — воспоминание пересоберётся по тем же правилам, без нового анализа.</p>
      <div className="mb-4"><MoodBlob value={v} base={day.style?.palette.accents[0] ?? '#b5653a'} onChange={(nv) => { setState('idle'); onChange(nv); }} /></div>
      <div className="space-y-4">
        {slider('warmth', 'холоднее', 'теплее')}
        {slider('energy', 'спокойнее', 'живее')}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={!changed || state === 'saving'} onClick={async () => {
          setState('saving'); setError(null);
          try {
            const saved = await api.restyle(day.id, value ?? { warmth: 0, energy: 0 });
            onSaved(saved); setState('saved');
          } catch (e) {
            const msg = e instanceof Error ? e.message : '';
            setState('error');
            setError(/404/.test(msg) ? 'Сохранение поправки ещё не подключено на сервере — превью уже работает' : msg || 'Не удалось сохранить');
          }
        }} className="rounded-full bg-foreground px-4 py-2 font-mono text-xs uppercase tracking-wider text-background disabled:opacity-30">
          {state === 'saving' ? 'сохраняю…' : 'Сохранить'}
        </button>
        <button type="button" onClick={() => { onChange(day.moodOverride ?? null); setState('idle'); }} className="font-mono text-xs underline">отменить</button>
        <button type="button" onClick={() => { onChange(null); setState('idle'); }} className="font-mono text-xs underline">как решила система</button>
        {state === 'saved' && <span className="text-sm text-green-700 dark:text-green-400">Сохранено ✓</span>}
      </div>
      {error && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>}
    </section>
  );
}
