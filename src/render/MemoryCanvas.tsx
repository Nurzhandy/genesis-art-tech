'use client';
// React-обёртка движка воспоминания.
import { useEffect, useRef, useState } from 'react';
import type { StyleParams, Technique } from '@/lib/types';
import { createEngine, type Engine } from './engine';
import type { DayInfo } from './types';

export interface MemoryCanvasProps {
  style: StyleParams;
  photos: string[];
  info: DayInfo;
  playing: boolean;
  liveEnergy?: () => number | null;
  /** B11 V2: полосы и удары живого звука. */
  liveRhythm?: () => import('./audioReactive').Rhythm | null;
  overrideTechnique?: { primary?: Technique; secondary?: Technique | null; mix?: number };
  /** «Фото» или «Рисунок» (нарисованная сцена дня). */
  mode?: 'photo' | 'drawing';
  /** Момент для статичного кадра, когда playing=false (по умолчанию — постерный кадр). */
  stillAt?: number;
  onReady?: (engine: Engine) => void;
  className?: string;
}

export default function MemoryCanvas({ style, photos, info, playing, liveEnergy, liveRhythm, overrideTechnique, mode = 'photo', stillAt, onReady, className }: MemoryCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [state, setState] = useState<{ key: string; ready: boolean; error: string | null }>({ key: '', ready: false, error: null });
  const live = useRef(liveEnergy);
  const liveR = useRef(liveRhythm);
  const onReadyRef = useRef(onReady);
  useEffect(() => { live.current = liveEnergy; liveR.current = liveRhythm; onReadyRef.current = onReady; });

  const key = JSON.stringify([style, photos, info, overrideTechnique, mode]);
  const ready = state.key === key && state.ready;
  const error = state.key === key ? state.error : null;
  useEffect(() => {
    let cancelled = false;
    const canvas = ref.current;
    if (!canvas) return;
    createEngine(canvas, { style, photoUrls: photos, info, overrideTechnique, mode, liveEnergy: () => live.current?.() ?? null, liveRhythm: () => liveR.current?.() ?? null })
      .then((engine) => {
        if (cancelled) { engine.destroy(); return; }
        engineRef.current = engine;
        engine.renderAt(stillAt ?? engine.interval * 0.4);
        setState({ key, ready: true, error: null });
        onReadyRef.current?.(engine);
      })
      .catch((e) => !cancelled && setState({ key, ready: false, error: e instanceof Error ? e.message : 'Не удалось нарисовать день' }));
    return () => { cancelled = true; engineRef.current?.destroy(); engineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const e = engineRef.current;
    if (!e || !ready) return;
    if (playing) e.play(); else { e.pause(); }
  }, [playing, ready]);

  return (
    <div className={`relative aspect-[9/16] w-full overflow-hidden bg-black/5 ${className ?? ''}`}>
      <canvas ref={ref} className="h-full w-full" aria-label={`Воспоминание дня «${info.title}»`} role="img" />
      {!ready && !error && <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-muted">рисую день…</div>}
      {error && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-red-700">{error}</div>}
    </div>
  );
}
