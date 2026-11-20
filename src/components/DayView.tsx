'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { buildStyle } from '@/lib/style/buildStyle';
import type { DayRecord, MoodOverride } from '@/lib/types';
import { FolderPanel } from './FolderPanel';
import { GenerateProgress } from './GenerateProgress';
import { useIsMyDiary } from '@/lib/client/diaryKey';
import { MemoryPlayer, songLabel } from './MemoryPlayer';
import { SharePanel } from './SharePanel';
import { ExportPanel } from './ExportPanel';
import { PhotoStack } from './PhotoStack';
import { PageAtmosphere } from './fx/PageAtmosphere';
import { VoiceRecorder } from './VoiceRecorder';
import { DecorEditor } from './decor/DecorEditor';
import { songKeys } from '@/lib/music/songKey';
import { humanDate } from '@/lib/archive';
import { ritualFor } from '@/lib/ritual';
import { MoodTuner } from './MoodTuner';
import { VoiceButton } from './VoiceButton';
import { WhyPanel } from './WhyPanel';

export function DayView({ dayId, from = null }: { dayId: string; from?: string | null }) {
  const [day, setDay] = useState<DayRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [override, setOverride] = useState<MoodOverride | null | undefined>(undefined);
  const [decorating, setDecorating] = useState(false);
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
      weather: day.weather ?? null,
    });
  }, [day, settled]);
  // Поправлять, переименовывать и удалять может только владелец дневника (ключ на этом устройстве).
  const mine = useIsMyDiary(day?.diaryId ?? '');

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
  if (day.sealed) {
    // Капсула времени (план 20.11, A5): до даты открытия — только конверт.
    return (
      <div className="flex flex-col items-center gap-6 py-16 text-center">
        <Link href={`/diary/${day.diaryId}`} className="font-mono text-xs uppercase tracking-[0.2em] text-muted hover:text-foreground">← дневник</Link>
        <div className="relative flex aspect-[4/3] w-full max-w-sm flex-col items-center justify-center gap-3 overflow-hidden rounded-sm bg-[#e8dcc4] text-[#4a3a28] shadow-2xl ring-1 ring-black/10">
          <div className="absolute inset-x-0 top-0 h-1/2 bg-[#dccdb0] [clip-path:polygon(0_0,100%_0,50%_100%)]" aria-hidden />
          <span className="relative grid h-14 w-14 place-items-center rounded-full bg-[#8b2e24] text-xl text-[#f4ead6] shadow-lg" aria-hidden>✉</span>
          <p className="relative font-mono text-xs uppercase tracking-[0.25em] opacity-70">капсула времени</p>
        </div>
        <h1 className="text-4xl font-semibold leading-tight">{day.title}</h1>
        <p className="font-mono text-xs text-muted">{day.date.split('-').reverse().join('.')}</p>
        <p className="font-hand text-3xl">Откроется {day.sealedUntil ? humanDate(day.sealedUntil) : ''}</p>
        <p className="max-w-md text-muted">День уже собран и лежит в папке, но запечатан: текст, фото и песню можно будет увидеть в день открытия.</p>
      </div>
    );
  }
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
      {(preview ?? day.style) && <PageAtmosphere style={(preview ?? day.style)!} />}
      {/* После сохранения поправки плеер собирается заново и сохраняет новый постер (старый сброшен на сервере). */}
      {decorating && day.style ? (
        <DecorEditor day={day} style={day.style} onClose={() => setDecorating(false)} onSaved={(d) => { setDay(d); setDecorating(false); }} />
      ) : (
        <div className="flex flex-col gap-3">
          <MemoryPlayer key={`${day.moodOverride?.warmth ?? 0}:${day.moodOverride?.energy ?? 0}:${day.decor?.items.length ?? 0}`} day={day} styleOverride={preview} ritual={ritualFor(day, from)} />
          {mine && day.style && (
            // Свободная страница (спека 2026-11-20): человек дополняет собранное системой своими стикерами, текстом и рисунком.
            <button type="button" data-magnetic onClick={() => setDecorating(true)}
              className="mx-auto rounded-full border border-foreground/30 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] transition-colors hover:bg-foreground hover:text-background">
              ✎ Украсить страницу
            </button>
          )}
        </div>
      )}
      <div className="flex flex-col gap-6">
        <header>
          <Link href={`/diary/${day.diaryId}`} className="font-mono text-xs uppercase tracking-[0.2em] text-muted hover:text-foreground">← дневник</Link>
          <h1 className="mt-3 text-5xl font-semibold leading-tight">{day.title}</h1>
          <p className="mt-1 font-mono text-xs text-muted">{day.date}{day.analysis?.moodWords?.length ? ` · ${day.analysis.moodWords.join(', ')}` : ''}</p>
          {songKeys(day.song).length > 0 && songLabel(day) && (
            <Link href={`/diary/${day.diaryId}?${songKeys(day.song).map((k) => `song=${encodeURIComponent(k)}`).join('&')}`} title="Все дни с этой песней"
              className="mt-2 inline-block font-hand text-2xl underline decoration-foreground/20 decoration-dotted underline-offset-4 hover:decoration-foreground">
              ♪ {songLabel(day)} <span className="font-mono text-[11px] text-muted no-underline">· все дни этой песни</span>
            </Link>
          )}
        </header>
        <p className="whitespace-pre-line text-xl leading-relaxed">{day.text}</p>
        <VoiceButton key={day.voice?.path ?? 'none'} day={day} />
        {mine && <VoiceRecorder day={day} onSaved={setDay} />}
        <PhotoStack day={day} />
        {mine && day.analysis && day.style && (
          <MoodTuner day={day} value={override === undefined ? day.moodOverride ?? null : override}
            onChange={setOverride} onSaved={(d) => { setDay(d); setOverride(undefined); setSettled(undefined); }} />
        )}
        {(preview ?? day.style) && <WhyPanel style={(preview ?? day.style)!} />}
        <ExportPanel day={day} />
        {mine && <SharePanel day={day} onChange={setDay} />}
        <FolderPanel day={day} onChange={setDay} />
        {day.analysis?.source === 'fallback' && <p className="text-xs text-muted">Настроение записи определено по словам и цветам — без AI-анализа.</p>}
      </div>
    </div>
  );
}
