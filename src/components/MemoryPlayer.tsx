'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client/api';
import { fadeVolume, VOICE_DUCK, VOICE_EVENT } from '@/lib/client/fade';
import { playPageFlip, startSoundscape, type SoundscapePlayer } from '@/lib/sound/player';
import { AMBIENT_LEVEL, soundscapeFor } from '@/lib/sound/recipes';
import type { DayRecord, StyleParams } from '@/lib/types';
import type { Engine } from '@/render/engine';
import { exportPoster } from '@/render/poster';
import { createEnergyMeter } from '@/render/audioReactive';
import { songObjectPlace } from '@/render/songObject';
import { LAYOUT } from '@/lib/style/constants';

const MemoryCanvas = dynamic(() => import('@/render/MemoryCanvas'), { ssr: false });
const OBJ = songObjectPlace(LAYOUT.width, LAYOUT.height).box;

export function songLabel(day: DayRecord): string {
  const s = day.song;
  const parts = [s.artist, s.title].filter(Boolean);
  return parts.length ? parts.join(' — ') : s.kind === 'file' ? 'своя песня' : '';
}

export function MemoryPlayer({ day, styleOverride }: { day: DayRecord; styleOverride?: StyleParams | null }) {
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const meter = useRef<(() => number) | null>(null);
  // Постер рисуем для сохранённого стиля дня: заново после «Сохранить» в «Не совсем так?»,
  // но никогда — для несохранённого превью ползунков.
  const exportedFor = useRef<string | null>(null);
  const latest = useRef({ day, styleOverride });
  useEffect(() => { latest.current = { day, styleOverride }; });
  const embed = day.song.kind === 'link' ? day.song.embedUrl : undefined;

  const engineRef = useRef<{ engine: Engine; styleKey: string } | null>(null);
  const tryExportPoster = useCallback(async () => {
    const { day: d, styleOverride: preview } = latest.current;
    if (!engineRef.current || preview || d.posterUrl || !d.style) return;
    const key = JSON.stringify(d.style);
    // Снимаем постер только с холста, нарисованного именно этим стилем.
    if (engineRef.current.styleKey !== key || exportedFor.current === key) return;
    const { engine } = engineRef.current;
    exportedFor.current = key;
    try {
      const blob = await exportPoster(engine);
      const { uploads } = await api.requestUploads(d.id, [{ kind: 'poster', ext: 'jpg' }]);
      await api.uploadFile(uploads[0], blob);
    } catch { /* постер — приятный бонус, не критично */ }
  }, []);
  const onReady = useCallback((engine: Engine) => {
    const { day: d, styleOverride: preview } = latest.current;
    engineRef.current = { engine, styleKey: JSON.stringify(preview ?? d.style) };
    void tryExportPoster();
  }, [tryExportPoster]);
  // После «Сохранить» стиль тот же, что в превью, и холст не пересоздаётся — проверяем постер по смене дня.
  useEffect(() => { void tryExportPoster(); }, [day, styleOverride, tryExportPoster]);

  // Звуки дня под атмосферный слой (план 20.11, B4); выбор человека помним.
  const scapeRef = useRef<SoundscapePlayer | null>(null);
  const [ambientOn, setAmbientOn] = useState(() => {
    try { return localStorage.getItem('diary-ambient') !== 'off'; } catch { return true; }
  });
  const atmosphereKind = (styleOverride ?? day.style)?.atmosphere?.kind ?? 'none';
  function startAmbient() {
    scapeRef.current?.stop();
    scapeRef.current = startSoundscape(soundscapeFor(atmosphereKind));
    scapeRef.current?.setLevel(AMBIENT_LEVEL, 2000);
  }
  function toggleAmbient() {
    const next = !ambientOn;
    setAmbientOn(next);
    try { localStorage.setItem('diary-ambient', next ? 'on' : 'off'); } catch { /* не критично */ }
    if (next) startAmbient(); else { scapeRef.current?.stop(); scapeRef.current = null; }
  }

  function start() {
    setOpen(true);
    playPageFlip();
    if (ambientOn) startAmbient();
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

  useEffect(() => () => { audioRef.current?.pause(); scapeRef.current?.stop(); }, []);

  function toggleSong() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play().then(() => fadeVolume(a, 1, 800)).catch(() => undefined);
    else a.pause();
  }

  // Пока звучит озвучка, музыка тише (25%), потом плавно возвращается.
  useEffect(() => {
    const onVoice = (e: Event) => {
      const speaking = (e as CustomEvent<{ speaking: boolean }>).detail.speaking;
      scapeRef.current?.setLevel(speaking ? AMBIENT_LEVEL * VOICE_DUCK : AMBIENT_LEVEL, speaking ? 600 : 1500);
      const a = audioRef.current;
      if (!a || a.paused) return;
      fadeVolume(a, speaking ? VOICE_DUCK : 1, speaking ? 600 : 1500);
    };
    window.addEventListener(VOICE_EVENT, onVoice);
    return () => window.removeEventListener(VOICE_EVENT, onVoice);
  }, []);

  const style = styleOverride ?? day.style;
  if (!style) return null;
  const photos = day.photos.map((p) => p.url ?? p.thumbUrl ?? '').filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto w-full max-w-[420px]">
        {/* Ритуал открытия: кадр проявляется из цвета дня за 1,5 с, уходя из размытия. */}
        <div style={{ opacity: open ? 1 : 0, filter: open ? 'blur(0px)' : 'blur(14px)', transition: 'opacity 1.5s ease, filter 1.5s ease' }}>
          <MemoryCanvas style={style} photos={photos} playing={open} onReady={onReady}
            liveEnergy={() => meter.current?.() ?? null}
            info={{ title: day.title ?? '', caption: day.analysis?.caption ?? '', date: day.date, dayNumber: day.dayNumber, songLabel: songLabel(day), notes: day.analysis?.sensory }}
            className="rounded-sm shadow-2xl" />
        </div>
        <button type="button" onClick={start} aria-hidden={open} tabIndex={open ? -1 : 0}
          className="absolute inset-0 flex flex-col items-center justify-center gap-6 rounded-sm px-8 text-center"
          style={{ background: style.palette.bg, color: style.palette.ink, opacity: open ? 0 : 1, pointerEvents: open ? 'none' : 'auto', transition: 'opacity 1.5s ease' }}>
          <span className="font-mono text-xs uppercase tracking-[0.3em] opacity-70">{day.date.split('-').reverse().join('.')}</span>
          <span className="text-4xl font-semibold leading-tight">{day.title}</span>
          <span className="rounded-full border px-6 py-3 font-mono text-sm uppercase tracking-[0.15em]" style={{ borderColor: style.palette.ink }}>▶ Открыть день</span>
          {songLabel(day) && <span className="font-hand text-2xl opacity-80">♪ {songLabel(day)}</span>}
        </button>
        {open && (day.songUrl || atmosphereKind !== 'none') && (
          <div className="absolute right-3 top-3 flex gap-1.5">
            {atmosphereKind !== 'none' && (
              <button type="button" onClick={toggleAmbient} aria-pressed={ambientOn} title={soundscapeFor(atmosphereKind).label}
                className={`rounded-full px-3 py-1.5 font-mono text-[11px] text-white ${ambientOn ? 'bg-black/50' : 'bg-black/25 line-through'}`}>≈ звуки дня</button>
            )}
            {day.songUrl && (
              <button type="button" onClick={toggleSong} className="rounded-full bg-black/50 px-3 py-1.5 font-mono text-[11px] text-white">♪ звук</button>
            )}
          </div>
        )}
        {/* Песня как предмет (S2): пластинка, кассета, CD или стикер на холсте — по клику песня играет или замолкает. */}
        {open && day.songUrl && style.songObject && (
          <button type="button" onClick={toggleSong} aria-label={`Включить или остановить песню${songLabel(day) ? ` «${songLabel(day)}»` : ''}`}
            title="Нажмите, чтобы включить или остановить песню"
            className="absolute cursor-pointer rounded-full transition hover:bg-white/10"
            style={{ left: `${OBJ.x * 100}%`, top: `${OBJ.y * 100}%`, width: `${OBJ.w * 100}%`, height: `${OBJ.h * 100}%` }} />
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
