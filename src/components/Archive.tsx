'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import type { DayRecord } from '@/lib/types';
import { DayCard } from './DayCard';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export function Archive({ diaryId, isDemo }: { diaryId: string; isDemo: boolean }) {
  const [days, setDays] = useState<DayRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [view, setView] = useState<'grid' | 'feed'>('grid');

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      api.listDays(diaryId, q.trim()).then((d) => alive && setDays(d), (e) => alive && setError(e instanceof Error ? e.message : 'Не удалось открыть дневник'));
    }, q ? 300 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [diaryId, q]);

  const groups = useMemo(() => {
    const m = new Map<string, DayRecord[]>();
    for (const d of days ?? []) {
      const key = `${MONTHS[Number(d.date.slice(5, 7)) - 1]} ${d.date.slice(0, 4)}`;
      m.set(key, [...(m.get(key) ?? []), d]);
    }
    return [...m.entries()];
  }, [days]);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти день: «какао», «офис», «снег»…"
          className="min-w-0 flex-1 border-b border-foreground/30 bg-transparent py-2 text-lg outline-none placeholder:text-muted/70 focus:border-foreground" />
        <div className="inline-flex rounded-full border border-foreground/20 p-0.5 font-mono text-xs">
          {(['grid', 'feed'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-full px-3 py-1 ${view === v ? 'bg-foreground text-background' : 'text-muted'}`}>{v === 'grid' ? 'сетка' : 'лента'}</button>
          ))}
        </div>
        {!isDemo && (
          <Link href={`/diary/${diaryId}/new`} className="rounded-full bg-foreground px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-background">+ Записать день</Link>
        )}
      </div>

      {error && <p className="text-red-700">{error}</p>}
      {!days && !error && <p className="font-mono text-xs text-muted">листаю дневник…</p>}
      {days && days.length === 0 && (
        <div className="py-16 text-center">
          <p className="font-hand text-4xl">{q ? 'Ничего не нашлось' : 'Здесь пока пусто'}</p>
          {!q && !isDemo && <Link href={`/diary/${diaryId}/new`} className="mt-4 inline-block underline">Запишите первый день</Link>}
        </div>
      )}

      {days && days.length > 0 && view === 'feed' && (
        <div className="-mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-6">
          {[...days].reverse().map((d) => <div key={d.id} className="w-[240px] shrink-0 snap-start sm:w-[280px]"><DayCard day={d} large /></div>)}
        </div>
      )}

      {days && days.length > 0 && view === 'grid' && groups.map(([month, list]) => (
        <section key={month} className="mb-10">
          <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-muted">{month}</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
            {list.map((d) => <DayCard key={d.id} day={d} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
