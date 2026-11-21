'use client';
// Полноэкранная книга дневника: тёмный «стол» вокруг, книга на всю высоту окна, развороты листаются.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { useIsMyDiary } from '@/lib/client/diaryKey';
import type { DayRecord } from '@/lib/types';
import { BookView } from '../BookView';

export function DiaryBook({ diaryId, title, cover, kindLabel, opened }: { diaryId: string; title: string; cover: string; kindLabel: string; opened: boolean }) {
  const [days, setDays] = useState<DayRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mine = useIsMyDiary(diaryId);

  useEffect(() => {
    let alive = true;
    api.listDays(diaryId).then((d) => alive && setDays(d), (e) => alive && setError(e instanceof Error ? e.message : 'Не удалось открыть дневник'));
    return () => { alive = false; };
  }, [diaryId]);

  return (
    <main className="flex min-h-screen flex-1 flex-col bg-[#14110d] text-[#efe7da]"
      style={{ backgroundImage: `radial-gradient(ellipse at 50% 40%, color-mix(in srgb, ${cover} 22%, transparent), transparent 70%)` }}>
      <header className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center gap-4 px-4 py-4">
        <Link href="/home" className="font-mono text-xs uppercase tracking-[0.2em] text-[#efe7da]/60 hover:text-[#efe7da]">← стол</Link>
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#efe7da]/50">{kindLabel}</span>
          <h1 className="truncate text-2xl font-semibold">{title}</h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link href={`/diary/${diaryId}`} className="rounded-full border border-[#efe7da]/25 px-4 py-2 font-mono text-[11px] uppercase tracking-wider transition hover:bg-[#efe7da] hover:text-[#14110d]">архив</Link>
          {mine && (
            <Link href={`/diary/${diaryId}/new`} data-magnetic className="rounded-full bg-[#efe7da] px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-[#14110d]">+ записать день</Link>
          )}
        </div>
      </header>
      <div className="flex flex-1 flex-col justify-center px-4 pb-6 [--muted:#a59a8b] [--foreground:#efe7da]">
        {error && <p className="text-center text-red-300">{error}</p>}
        {!days && !error && <p className="text-center font-mono text-xs text-[#efe7da]/60">открываю книгу…</p>}
        {days && (
          <BookView days={days.filter((d) => !d.sealed)} title={title} cover={cover} large startOpen={opened}
            emptyHref={mine ? `/diary/${diaryId}/new` : undefined} />
        )}
      </div>
    </main>
  );
}
