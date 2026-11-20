'use client';
// Архив дневника (A8): сетка по месяцам, лента, календарь (R12), «В этот день» (R12), случайный день (R12), поиск.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { useStored, writeStored } from '@/lib/client/diaryKey';
import { dayColor, groupByMonth, humanDate, localToday, monthGrid, monthLabel, onThisDay, yearsAgo, yearsWord } from '@/lib/archive';
import type { DayRecord } from '@/lib/types';
import { BookView } from './BookView';
import { songLabel } from './MemoryPlayer';
import { DayCard } from './DayCard';
import { DiaryKey } from './DiaryKey';

type View = 'grid' | 'book' | 'feed' | 'calendar';
const VIEWS: [View, string][] = [['grid', 'сетка'], ['book', 'книга'], ['feed', 'лента'], ['calendar', 'календарь']];
const WEEK = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const VIEW_KEY = 'atmosphere-archive-view';

function Calendar({ days }: { days: DayRecord[] }) {
  const months = groupByMonth(days);
  return (
    <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {months.map(([key, list]) => (
        <section key={key}>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-muted">{monthLabel(key)}</h2>
          <div className="grid grid-cols-7 gap-1.5 text-center font-mono text-[10px] text-muted">
            {WEEK.map((w) => <span key={w}>{w}</span>)}
            {monthGrid(key, list).map((cell, i) => {
              if (!cell) return <span key={`e${i}`} />;
              const d = cell.entries[0];
              if (!d) return <span key={cell.date} className="flex aspect-square items-center justify-center rounded-sm bg-foreground/[0.04]">{cell.day}</span>;
              return (
                <Link key={cell.date} href={`/day/${d.id}`} title={`${humanDate(d.date)} · ${d.title}`}
                  className="relative flex aspect-square items-center justify-center rounded-sm text-[11px] font-semibold text-white shadow-sm ring-1 ring-black/10 transition hover:scale-110"
                  style={{ background: dayColor(d) }}>
                  <span className="[text-shadow:0_0_3px_rgba(0,0,0,0.6)]">{cell.day}</span>
                  {cell.entries.length > 1 && <span className="absolute right-0.5 top-0 text-[8px]">+{cell.entries.length - 1}</span>}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function OnThisDay({ days }: { days: DayRecord[] }) {
  const today = localToday();
  const found = onThisDay(days, today);
  if (!found.length) return null;
  return (
    <section className="mb-10 rounded-sm border border-foreground/15 p-5">
      <p className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-muted">В этот день · {humanDate(today).replace(/ \d{4}$/, '')}</p>
      <div className="flex gap-5 overflow-x-auto pb-2">
        {found.map((d) => (
          <div key={d.id} className="w-[150px] shrink-0">
            <p className="mb-2 font-hand text-2xl leading-none">{yearsWord(yearsAgo(d.date, today))} назад</p>
            <DayCard day={d} from="onthisday" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function Archive({ diaryId, isDemo, songs = [], title }: { diaryId: string; isDemo: boolean; songs?: string[]; title?: string }) {
  const songParam = songs.join('\n');
  const song = songParam;
  const router = useRouter();
  const [days, setDays] = useState<DayRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  // Выбранный вид архива запоминается на устройстве.
  const savedView = useStored(VIEW_KEY);
  const view: View = VIEWS.some(([v]) => v === savedView) ? (savedView as View) : 'grid';
  const pickView = (v: View) => writeStored(VIEW_KEY, v);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      api.listDays(diaryId, q.trim(), songParam ? songParam.split('\n') : []).then((d) => { if (alive) { setDays(d); setError(null); } }, (e) => alive && setError(e instanceof Error ? e.message : 'Не удалось открыть дневник'));
    }, q ? 300 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [diaryId, q, songParam]);

  const groups = useMemo(() => groupByMonth(days ?? []), [days]);

  function randomDay() {
    if (!days?.length) return;
    router.push(`/day/${days[Math.floor(Math.random() * days.length)].id}`);
  }

  return (
    <div>
      {/* Ключ показываем, только когда сервер подтвердил, что такой дневник есть. */}
      {!isDemo && days && !error && <DiaryKey diaryId={diaryId} />}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти день: «какао», «офис», «снег»…" aria-label="Поиск по дням"
          className="min-w-0 flex-1 basis-56 border-b border-foreground/30 bg-transparent py-2 text-lg outline-none placeholder:text-muted/70 focus:border-foreground" />
        <div className="inline-flex rounded-full border border-foreground/20 p-0.5 font-mono text-xs" role="tablist">
          {VIEWS.map(([v, label]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => pickView(v)}
              className={`rounded-full px-3 py-1 ${view === v ? 'bg-foreground text-background' : 'text-muted hover:text-foreground'}`}>{label}</button>
          ))}
        </div>
        {days && days.length > 1 && (
          <button type="button" onClick={randomDay} title="Открыть случайный день"
            className="rounded-full border border-foreground/20 px-3 py-1.5 font-mono text-xs text-muted transition hover:border-foreground/50 hover:text-foreground">
            ⚄ случайный день
          </button>
        )}
        {days && days.some((d) => !d.sealed) && (
          <Link href={`/diary/${diaryId}/year/${days.find((d) => !d.sealed)!.date.slice(0, 4)}`} title="Все дни года одной картинкой"
            className="rounded-full border border-foreground/20 px-3 py-1.5 font-mono text-xs text-muted transition hover:border-foreground/50 hover:text-foreground">
            ▦ год в цветах
          </Link>
        )}
        {!isDemo && (
          <Link href={`/diary/${diaryId}/new`} className="rounded-full bg-foreground px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-background">+ Записать день</Link>
        )}
      </div>

      {song && (
        <div className="mb-8 flex flex-wrap items-baseline gap-3 rounded-sm border border-foreground/15 px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">все дни песни</p>
          <p className="font-hand text-2xl">♪ {days?.filter((d) => !d.sealed).map(songLabel).find(Boolean) ?? '…'}</p>
          {days && <p className="font-mono text-xs text-muted">{days.length} дн.</p>}
          <Link href={`/diary/${diaryId}`} className="ml-auto font-mono text-xs text-muted underline-offset-4 hover:text-foreground hover:underline">показать все дни</Link>
        </div>
      )}
      {error && <p className="text-red-700">{error}</p>}
      {!days && !error && <p className="font-mono text-xs text-muted">листаю дневник…</p>}
      {days && days.length === 0 && (
        <div className="py-16 text-center">
          <p className="font-hand text-4xl">{q ? 'Ничего не нашлось' : 'Здесь пока пусто'}</p>
          {!q && !isDemo && <Link href={`/diary/${diaryId}/new`} className="mt-4 inline-block underline">Запишите первый день</Link>}
        </div>
      )}

      {days && days.length > 0 && !q && !song && <OnThisDay days={days} />}

      {days && days.length > 0 && view === 'feed' && (
        <div className="-mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-6">
          {[...days].reverse().map((d) => <div key={d.id} className="w-[240px] shrink-0 snap-start sm:w-[280px]"><DayCard day={d} large /></div>)}
        </div>
      )}

      {days && days.length > 0 && view === 'calendar' && <Calendar days={days} />}

      {days && days.length > 0 && view === 'book' && <BookView days={days.filter((d) => !d.sealed)} title={title ?? (isDemo ? 'Демо-дневник' : 'Мой дневник')} />}

      {days && days.length > 0 && view === 'grid' && groups.map(([month, list]) => (
        <section key={month} className="mb-10">
          <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-muted">{monthLabel(month)}</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
            {list.map((d) => <DayCard key={d.id} day={d} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
