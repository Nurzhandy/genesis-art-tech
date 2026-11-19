'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client/api';
import type { DayRecord } from '@/lib/types';
import type { Engine } from '@/render/engine';
import { exportPoster } from '@/render/poster';
import { createEnergyMeter } from '@/render/audioReactive';

const MemoryCanvas = dynamic(() => import('@/render/MemoryCanvas'), { ssr: false });

export function songLabel(day: DayRecord): string {
  const s = day.song;
  const parts = [s.artist, s.title].filter(Boolean);
  return parts.length ? parts.join(' — ') : s.kind === 'file' ? 'своя песня' : '';
}

export function MemoryPlayer({ day }: { day: DayRecord }) {
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const meter = useRef<(() => number) | null>(null);
  const posterDone = useRef(Boolean(day.posterUrl));
  const embed = day.song.kind === 'link' ? day.song.embedUrl : undefined;

  const onReady = useCallback(async (engine: Engine) => {
    if (posterDone.current) return;
    posterDone.current = true;
    try {
      const blob = await exportPoster(engine);
      const { uploads } = await api.requestUploads(day.id, [{ kind: 'poster', ext: 'png' }]);
      await api.uploadFile(uploads[0], blob);
    } catch { /* постер — приятный бонус, не критично */ }
  }, [day.id]);

  function start() {
    setOpen(true);
    if (day.songUrl) {
      const a = audioRef.current ?? new Audio();
      audioRef.current = a;
      a.crossOrigin = 'anonymous';
      a.src = day.songUrl;
      a.loop = true;
      try { meter.current = createEnergyMeter(a); } catch { meter.current = null; }
      void a.play().catch(() => undefined);
    }
  }

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  if (!day.style) return null;
  const photos = day.photos.map((p) => p.url ?? p.thumbUrl ?? '').filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto w-full max-w-[420px]">
        <MemoryCanvas style={day.style} photos={photos} playing={open} onReady={onReady}
          liveEnergy={() => meter.current?.() ?? null}
          info={{ title: day.title ?? '', caption: day.analysis?.caption ?? '', date: day.date, dayNumber: day.dayNumber, songLabel: songLabel(day) }}
          className="rounded-sm shadow-2xl" />
        {!open && (
          <button type="button" onClick={start}
            className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/45 via-transparent to-transparent pb-10">
            <span className="rounded-full bg-white/90 px-6 py-3 font-mono text-sm uppercase tracking-[0.15em] text-black shadow-lg">▶ Открыть день</span>
          </button>
        )}
        {open && day.songUrl && (
          <button type="button" onClick={() => { const a = audioRef.current; if (a) { if (a.paused) void a.play(); else a.pause(); } }}
            className="absolute right-3 top-3 rounded-full bg-black/50 px-3 py-1.5 font-mono text-[11px] text-white">♪ звук</button>
        )}
      </div>
      {open && !day.songUrl && embed && (
        <div className="mx-auto w-full max-w-[420px]">
          <p className="mb-2 text-center text-sm text-muted">Включите песню дня здесь — анимация уже идёт в её ритме</p>
          <iframe src={embed} title="Песня дня" className="h-[152px] w-full rounded-xl border-0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
        </div>
      )}
      {open && !day.songUrl && !embed && day.song.kind === 'link' && (
        <a href={day.song.url} target="_blank" rel="noreferrer" className="mx-auto font-mono text-xs underline">♪ открыть песню дня</a>
      )}
    </div>
  );
}
