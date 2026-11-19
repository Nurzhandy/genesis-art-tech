'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { buildStyle } from '@/lib/style/buildStyle';
import type { DayRecord, MoodOverride } from '@/lib/types';
import { FolderPanel } from './FolderPanel';
import { GenerateProgress } from './GenerateProgress';
import { MemoryPlayer } from './MemoryPlayer';
import { MoodTuner } from './MoodTuner';
import { VoiceButton } from './VoiceButton';
import { WhyPanel } from './WhyPanel';

export function DayView({ dayId }: { dayId: string }) {
  const [day, setDay] = useState<DayRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [override, setOverride] = useState<MoodOverride | null | undefined>(undefined);
  // Холст пересобирается не на каждый шаг ползунка, а после паузы 300 мс.
  const [settled, setSettled] = useState<MoodOverride | null | undefined>(undefined);
  useEffect(() => {
    const t = setTimeout(() => setSettled(override), 300);
    return () => clearTimeout(t);
  }, [override]);

  // Живое превью поправки: тот же движок правил прямо в браузере.
  const preview = useMemo(() => {
    if (!day?.analysis || !day.style || settled === undefined) return null;
    return buildStyle({
      analysis: day.analysis,
      photos: day.photos.map((p) => p.features),
      music: day.music ?? { source: 'llm', bpm: 90, energy: 0.5, mode: 'unknown' },
      date: day.date,
      seed: day.style.seed,
      moodOverride: settled,
    });
  }, [day, settled]);

  const load = useCallback(() => api.getDay(dayId).then(
    (d) => { setDay(d); setError(null); },
    (e) => setError(e instanceof Error ? e.message : 'Не удалось открыть день'),
  ), [dayId]);

  useEffect(() => {
    let alive = true;
    api.getDay(dayId).then(
      (d) => alive && setDay(d),
      (e) => alive && setError(e instanceof Error ? e.message : 'Не удалось открыть день'),
    );
    return () => { alive = false; };
  }, [dayId]);
  useEffect(() => {
    if (!day || day.status === 'ready' || day.status === 'error') return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [day, load]);

  if (error) return <p className="py-20 text-center text-lg">{error}</p>;
  if (!day) return <p className="py-20 text-center font-mono text-xs text-muted">открываю день…</p>;
  if (day.status === 'draft' || day.status === 'generating' || retrying) return <GenerateProgress />;
  if (day.status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="font-hand text-3xl">Этот день не собрался</p>
        <p className="max-w-md text-muted">{day.error}</p>
        {day.photos.length > 0 && (
          <button className="rounded-full bg-foreground px-6 py-3 font-mono text-sm uppercase tracking-wider text-background" onClick={async () => {
            setRetrying(true);
            try { setDay(await api.generate(day.id, { photoFeatures: day.photos.map((p) => p.features), music: day.music })); }
            catch (e) { setError(e instanceof Error ? e.message : 'Не получилось'); }
            finally { setRetrying(false); }
          }}>Повторить</button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,440px)_1fr]">
      <MemoryPlayer day={day} styleOverride={preview} />
      <div className="flex flex-col gap-6">
        <header>
          <Link href={`/diary/${day.diaryId}`} className="font-mono text-xs uppercase tracking-[0.2em] text-muted hover:text-foreground">← дневник</Link>
          <h1 className="mt-3 text-5xl font-semibold leading-tight">{day.title}</h1>
          <p className="mt-1 font-mono text-xs text-muted">{day.date}{day.analysis?.moodWords?.length ? ` · ${day.analysis.moodWords.join(', ')}` : ''}</p>
        </header>
        <p className="whitespace-pre-line text-xl leading-relaxed">{day.text}</p>
        <VoiceButton day={day} />
        {day.analysis && day.style && (
          <MoodTuner day={day} value={override === undefined ? day.moodOverride ?? null : override}
            onChange={setOverride} onSaved={(d) => { setDay(d); setOverride(undefined); setSettled(undefined); }} />
        )}
        {(preview ?? day.style) && <WhyPanel style={(preview ?? day.style)!} />}
        <FolderPanel day={day} />
        {day.analysis?.source === 'fallback' && <p className="text-xs text-muted">Настроение записи определено по словам и цветам — без AI-анализа.</p>}
      </div>
    </div>
  );
}
