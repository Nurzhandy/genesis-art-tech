'use client';
import { useState } from 'react';
import { downloadDayZip, folderFiles } from '@/lib/client/zipFolder';
import type { DayRecord } from '@/lib/types';

const ICON = { text: '¶', photo: '▣', audio: '♪', image: '◩', data: '{}' } as const;

export function FolderPanel({ day }: { day: DayRecord }) {
  const [busy, setBusy] = useState(false);
  const files = folderFiles(day);
  return (
    <section className="rounded-sm border border-foreground/15 p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-1 inline-block h-7 w-9 rounded-[3px] bg-foreground/80 [clip-path:polygon(0_15%,40%_15%,50%_0,100%_0,100%_100%,0_100%)]" aria-hidden />
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">папка дня</p>
          <h2 className="text-2xl font-semibold leading-tight">{day.title}</h2>
          <p className="font-mono text-[11px] text-muted">{day.date}-{day.slug}/</p>
        </div>
      </div>
      <ul className="mb-4 space-y-1 font-mono text-xs">
        {files.map((f) => (
          <li key={f.name} className="flex gap-3">
            <span className="w-5 text-center text-muted">{ICON[f.kind]}</span>
            {f.url ? <a className="underline-offset-2 hover:underline" href={f.url} target="_blank" rel="noreferrer">{f.name}</a> : <span>{f.name}</span>}
          </li>
        ))}
      </ul>
      <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await downloadDayZip(day); } finally { setBusy(false); } }}
        className="rounded-full border border-foreground/30 px-4 py-2 font-mono text-xs uppercase tracking-wider transition hover:bg-foreground hover:text-background disabled:opacity-40">
        {busy ? 'собираю архив…' : '↓ Скачать папку'}
      </button>
    </section>
  );
}
