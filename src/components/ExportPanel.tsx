'use client';
// Обои на телефон и видео дня (план 20.11, C1, C2).
import { useRef, useState, useSyncExternalStore } from 'react';
import type { DayRecord } from '@/lib/types';
import { canRecordVideo, download, exportName, recordVideo, renderWallpaper } from '@/render/exportDay';
import { songLabel } from './MemoryPlayer';

const LENGTHS = [15, 30, 60] as const;
const btn = 'rounded-full border border-foreground/30 px-4 py-2 font-mono text-xs uppercase tracking-wider transition hover:bg-foreground hover:text-background disabled:opacity-40';

export function ExportPanel({ day }: { day: DayRecord }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const label = songLabel(day);
  // На странице подарка панель рендерится и на сервере: запись видео проверяем только в браузере.
  const videoOk = useSyncExternalStore(() => () => undefined, canRecordVideo, () => false);
  const embedOnly = !day.songUrl && day.song.kind === 'link';

  async function wallpaper(noText: boolean) {
    setBusy(noText ? 'clean' : 'text'); setError(null); setNote(null);
    try {
      download(await renderWallpaper(day, label, noText), exportName(day, noText ? 'обои без текста' : 'обои', 'jpg'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось сохранить обои');
    } finally { setBusy(null); }
  }

  async function video(sec: number) {
    setBusy(`v${sec}`); setProgress(0); setError(null); setNote(null);
    abort.current = new AbortController();
    try {
      const { blob, ext, withSound } = await recordVideo(day, label, sec, setProgress, abort.current.signal);
      download(blob, exportName(day, `видео ${sec} с`, ext));
      setNote(withSound ? null : embedOnly
        ? 'Видео без звука: песня по ссылке играет в плеере сервиса, и записать её нельзя. Добавьте песню в видео в любом редакторе.'
        : 'Видео без звука: песню не получилось подключить.');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(e instanceof Error ? e.message : 'Не получилось записать видео');
    } finally { setBusy(null); abort.current = null; }
  }

  if (!day.style) return null;
  return (
    <section className="rounded-sm border border-foreground/15 p-5">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">забрать с собой</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted">Обои на телефон:</span>
        <button type="button" className={btn} disabled={!!busy} onClick={() => wallpaper(false)}>{busy === 'text' ? 'рисую…' : 'с текстом'}</button>
        <button type="button" className={btn} disabled={!!busy} onClick={() => wallpaper(true)}>{busy === 'clean' ? 'рисую…' : 'без текста'}</button>
      </div>
      {videoOk && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm text-muted">Видео 9:16:</span>
          {LENGTHS.map((s) => (
            <button key={s} type="button" className={btn} disabled={!!busy} onClick={() => video(s)}>{s} с</button>
          ))}
        </div>
      )}
      {busy?.startsWith('v') && (
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full bg-foreground transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="font-mono text-xs text-muted">записываю {Math.round(progress * Number(busy.slice(1)))} / {busy.slice(1)} с</span>
          <button type="button" onClick={() => abort.current?.abort()} className="font-mono text-xs text-muted underline-offset-4 hover:text-foreground hover:underline">стоп</button>
        </div>
      )}
      {busy?.startsWith('v') && <p className="mt-2 text-sm text-muted">Видео пишется в реальном времени — не закрывайте вкладку.</p>}
      {note && <p className="mt-3 text-sm text-muted">{note}</p>}
      {error && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
    </section>
  );
}
