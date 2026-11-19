'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client/api';
import { fadeVolume, VOICE_DUCK, VOICE_EVENT } from '@/lib/client/fade';
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
      const { uploads } = await api.requestUploads(day.id, [{ kind: 'poster', ext: 'jpg' }]);
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
      a.volume = 0;
      try { meter.current = createEnergyMeter(a); } catch { meter.current = null; }
      // Ритуал открытия: музыка с первой ноты, но нарастает за 2 секунды.
      void a.play().then(() => fadeVolume(a, 1, 2000)).catch(() => undefined);
    }
  }

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  // Пока звучит озвучка, музыка тише (25%), потом плавно возвращается.
  useEffect(() => {
    const onVoice = (e: Event) => {
      const a = audioRef.current;
      if (!a || a.paused) return;
      const speaking = (e as CustomEvent<{ speaking: boolean }>).detail.speaking;
      fadeVolume(a, speaking ? VOICE_DUCK : 1, speaking ? 600 : 1500);
    };
    window.addEventListener(VOICE_EVENT, onVoice);
    return () => window.removeEventListener(VOICE_EVENT, onVoice);
  }, []);

  if (!day.style) return null;
  const photos = day.photos.map((p) => p.url ?? p.thumbUrl ?? '').filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto w-full max-w-[420px]">
        {/* Ритуал открытия: кадр проявляется из цвета дня за 1,5 с, уходя из размытия. */}
        <div style={{ opacity: open ? 1 : 0, filter: open ? 'blur(0px)' : 'blur(14px)', transition: 'opacity 1.5s ease, filter 1.5s ease' }}>
          <MemoryCanvas style={day.style} photos={photos} playing={open} onReady={onReady}
            liveEnergy={() => meter.current?.() ?? null}
            info={{ title: day.title ?? '', caption: day.analysis?.caption ?? '', date: day.date, dayNumber: day.dayNumber, songLabel: songLabel(day), notes: day.analysis?.sensory }}
            className="rounded-sm shadow-2xl" />
        </div>
        <button type="button" onClick={start} aria-hidden={open} tabIndex={open ? -1 : 0}
          className="absolute inset-0 flex flex-col items-center justify-center gap-6 rounded-sm px-8 text-center"
          style={{ background: day.style.palette.bg, color: day.style.palette.ink, opacity: open ? 0 : 1, pointerEvents: open ? 'none' : 'auto', transition: 'opacity 1.5s ease' }}>
          <span className="font-mono text-xs uppercase tracking-[0.3em] opacity-70">{day.date.split('-').reverse().join('.')}</span>
          <span className="text-4xl font-semibold leading-tight">{day.title}</span>
          <span className="rounded-full border px-6 py-3 font-mono text-sm uppercase tracking-[0.15em]" style={{ borderColor: day.style.palette.ink }}>▶ Открыть день</span>
          {songLabel(day) && <span className="font-hand text-2xl opacity-80">♪ {songLabel(day)}</span>}
        </button>
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
