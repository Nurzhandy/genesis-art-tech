'use client';
// «Записать своим голосом» (план 20.11, C5): до 2 минут, прослушать, сохранить в папку дня.
// Своя запись важнее синтеза: кнопка «Послушать запись» дальше играет её.
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client/api';
import { MAX_RECORDING_SEC, pickRecordingType, recordingExt } from '@/lib/voice/ownVoice';
import type { DayRecord } from '@/lib/types';

type State = { kind: 'idle' } | { kind: 'recording'; sec: number } | { kind: 'review'; blob: Blob; url: string } | { kind: 'saving' };
const btn = 'rounded-full border border-foreground/30 px-4 py-2 font-mono text-xs uppercase tracking-wider transition hover:bg-foreground hover:text-background disabled:opacity-40';

export function VoiceRecorder({ day, onSaved }: { day: DayRecord; onSaved: (d: DayRecord) => void }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    rec.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  async function start() {
    setError(null);
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Этот браузер не умеет записывать звук'); return;
    }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { setError('Нет доступа к микрофону — разрешите его в настройках браузера'); return; }
    const mimeType = pickRecordingType((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      const blob = new Blob(chunks, { type: r.mimeType || mimeType || 'audio/webm' });
      setState({ kind: 'review', blob, url: URL.createObjectURL(blob) });
    };
    rec.current = r;
    r.start(1000);
    const t0 = Date.now();
    setState({ kind: 'recording', sec: 0 });
    timer.current = setInterval(() => {
      const sec = Math.floor((Date.now() - t0) / 1000);
      if (sec >= MAX_RECORDING_SEC) r.stop();
      else setState({ kind: 'recording', sec });
    }, 250);
  }

  async function save(blob: Blob) {
    setState({ kind: 'saving' }); setError(null);
    try {
      const { uploads } = await api.requestUploads(day.id, [{ kind: 'voice', ext: recordingExt(blob.type) }]);
      await api.uploadFile(uploads[0], blob);
      onSaved(await api.getDay(day.id));
      setState({ kind: 'idle' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось сохранить запись');
      setState({ kind: 'review', blob, url: URL.createObjectURL(blob) });
    }
  }

  const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const own = day.voice?.preset.voice === 'own';

  return (
    <section className="flex flex-col gap-2">
      {state.kind === 'idle' && (
        <button type="button" className={`${btn} self-start`} onClick={start}>🎙 {own ? 'Перезаписать своим голосом' : 'Записать своим голосом'}</button>
      )}
      {state.kind === 'recording' && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" aria-hidden />
          <span className="font-mono text-sm">{mm(state.sec)} / {mm(MAX_RECORDING_SEC)}</span>
          <button type="button" className={btn} onClick={() => rec.current?.stop()}>■ стоп</button>
          <p className="w-full text-sm text-muted">Прочитайте запись дня вслух — как письмо себе.</p>
        </div>
      )}
      {state.kind === 'review' && (
        <div className="flex flex-col gap-2">
          <audio src={state.url} controls className="w-full max-w-sm" />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={() => save(state.blob)}>сохранить в папку дня</button>
            <button type="button" className={btn} onClick={() => { URL.revokeObjectURL(state.url); setState({ kind: 'idle' }); }}>заново</button>
          </div>
        </div>
      )}
      {state.kind === 'saving' && <p className="font-mono text-xs text-muted">сохраняю запись…</p>}
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </section>
  );
}
