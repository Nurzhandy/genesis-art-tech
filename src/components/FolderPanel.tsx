'use client';
// «Папка дня» (A8): название, файлы с размерами, ZIP. Владельцу — переименовать (R11) и удалить (R14).
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { useIsMyDiary } from '@/lib/client/diaryKey';
import { downloadDayZip, folderFiles } from '@/lib/client/zipFolder';
import type { DayRecord } from '@/lib/types';

const ICON = { text: '¶', photo: '▣', audio: '♪', image: '◩', data: '{}' } as const;

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`;
}

export function FolderPanel({ day, onChange }: { day: DayRecord; onChange?: (d: DayRecord) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const mine = useIsMyDiary(day.diaryId);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(day.title ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const files = folderFiles(day);

  useEffect(() => {
    let alive = true;
    api.files(day.id).then(
      (r) => alive && setSizes(Object.fromEntries(r.files.map((f) => [f.name, f.size]))),
      () => undefined, // без размеров панель всё равно полезна
    );
    return () => { alive = false; };
  }, [day.id, day.slug, day.posterPath, day.voice?.path]);

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const next = await api.rename(day.id, title);
      setEditing(false);
      onChange?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не получилось переименовать');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Удалить день «${day.title}»?\n\nТекст, фото, песня, воспоминание и озвучка удалятся без возможности восстановления. Можно сначала скачать папку.`)) return;
    setBusy(true); setError(null);
    try {
      await api.deleteDay(day.id);
      router.push(`/diary/${day.diaryId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не получилось удалить');
      setBusy(false);
    }
  }

  const total = Object.values(sizes).reduce((a, b) => a + b, 0);

  return (
    <section className="rounded-sm border border-foreground/15 p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-1 inline-block h-7 w-9 shrink-0 rounded-[3px] bg-foreground/80 [clip-path:polygon(0_15%,40%_15%,50%_0,100%_0,100%_100%,0_100%)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">папка дня</p>
          {editing ? (
            <form onSubmit={rename} className="mt-1 flex flex-wrap items-center gap-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={120} aria-label="Название папки"
                className="min-w-0 flex-1 border-b border-foreground/40 bg-transparent py-1 text-2xl font-semibold outline-none focus:border-foreground" />
              <button type="submit" disabled={saving} className="font-mono text-xs uppercase tracking-wider underline-offset-4 hover:underline disabled:opacity-40">
                {saving ? 'сохраняю…' : 'сохранить'}
              </button>
              <button type="button" onClick={() => { setEditing(false); setTitle(day.title ?? ''); setError(null); }}
                className="font-mono text-xs uppercase tracking-wider text-muted hover:text-foreground">отмена</button>
              <p className="w-full text-xs text-muted">3–7 слов, без кавычек и эмодзи — как подпись к фотоальбому</p>
            </form>
          ) : (
            <h2 className="text-2xl font-semibold leading-tight">
              {day.title}
              {mine && (
                <button type="button" onClick={() => setEditing(true)} aria-label="Переименовать папку" title="Переименовать"
                  className="ml-2 align-middle font-mono text-xs text-muted hover:text-foreground">✎</button>
              )}
            </h2>
          )}
          <p className="break-all font-mono text-[11px] text-muted">{day.date}-{day.slug}/{total ? ` · ${formatSize(total)}` : ''}</p>
        </div>
      </div>
      <ul className="mb-4 space-y-1 font-mono text-xs">
        {files.map((f) => (
          <li key={f.name} className="flex gap-3">
            <span className="w-5 text-center text-muted">{ICON[f.kind]}</span>
            {f.url ? <a className="min-w-0 truncate underline-offset-2 hover:underline" href={f.url} target="_blank" rel="noreferrer">{f.name}</a> : <span className="min-w-0 truncate">{f.name}</span>}
            {sizes[f.name] !== undefined && <span className="ml-auto shrink-0 text-muted">{formatSize(sizes[f.name])}</span>}
          </li>
        ))}
      </ul>
      {error && <p className="mb-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await downloadDayZip(day); } finally { setBusy(false); } }}
          className="rounded-full border border-foreground/30 px-4 py-2 font-mono text-xs uppercase tracking-wider transition hover:bg-foreground hover:text-background disabled:opacity-40">
          {busy ? 'минутку…' : '↓ Скачать папку'}
        </button>
        {mine && (
          <button type="button" disabled={busy} onClick={remove}
            className="ml-auto font-mono text-[11px] uppercase tracking-wider text-muted underline-offset-4 transition hover:text-red-700 hover:underline disabled:opacity-40">
            удалить день
          </button>
        )}
      </div>
    </section>
  );
}
