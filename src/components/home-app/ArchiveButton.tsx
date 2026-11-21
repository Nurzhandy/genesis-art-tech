'use client';
// «Архив» с главной: один дневник — сразу его архив (сетка, книга, календарь…), несколько — сначала выбрать дневник.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { DIARY_KINDS, type DiaryMeta } from '@/lib/shelf';
import { plural } from './QuickDay';

const btn = 'inline-block rounded-full border border-foreground/30 px-7 py-3.5 text-lg transition hover:bg-foreground hover:text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground';

export function ArchiveButton({ diaries }: { diaries: DiaryMeta[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', close); };
  }, [open]);

  if (!diaries.length) return null;
  if (diaries.length === 1) return <Link href={`/diary/${diaries[0].id}`} className={btn}>Архив</Link>;

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} className={btn}>Архив</button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-30 mt-3 w-72 rounded-lg bg-[#fbf8f1] p-2 text-[#2b241c] shadow-2xl ring-1 ring-black/10 [--foreground:#2b241c] [--muted:#7a7064]"
          style={{ animation: 'pop-in 0.25s ease-out both' }}>
          <p className="px-3 pb-1 pt-2 font-hand text-xl text-muted">Архив какого дневника?</p>
          {diaries.map((d) => (
            <Link key={d.id} href={`/diary/${d.id}`} role="menuitem"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition hover:bg-foreground/5 focus-visible:bg-foreground/5 focus-visible:outline-none">
              <span className="grid h-9 w-7 shrink-0 place-items-center rounded-sm text-sm text-white shadow-sm" style={{ background: DIARY_KINDS[d.kind].cover }} aria-hidden>
                {DIARY_KINDS[d.kind].icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg leading-tight">{d.title}</span>
                <span className="block text-sm text-muted">{d.dayCount} {plural(d.dayCount)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
