'use client';
// Главная после входа (план 21.11, часть B): место, куда человек приходит каждый день.
// Тот же язык, что у лендинга: бумага, Cormorant, рукописный Caveat, стол с книгами.
// Сверху — приветствие и одна кнопка «Записать день», дальше незаконченные доски, стол и недавние дни на верёвке.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { api } from '@/lib/client/api';
import { signOut, useAuth, AUTH_ROUTES } from '@/lib/client/auth';
import { humanDate } from '@/lib/archive';
import { DIARY_KINDS } from '@/lib/shelf';
import type { AnyItem } from '@/lib/dayboard/layout';
import { Desk } from '@/components/shelf/Desk';
import { KineticTitle } from '@/components/home/KineticTitle';
import { BoardPreview } from '@/components/dayboard/BoardPreview';
import { QuickDay } from './QuickDay';
import { ArchiveButton } from './ArchiveButton';
import { useHomeData, type HomeDay } from './useHomeData';

const noop = () => () => undefined;

/** «Доброе утро» по часам устройства: приветствие говорит со временем суток, а не с сервером. */
export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 18) return 'Добрый день';
  if (hour >= 18 && hour < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

export function HomeApp() {
  const { user } = useAuth();
  const data = useHomeData();
  // Часы и дата — только в браузере (на сервере другой часовой пояс), до гидрации их нет.
  const now = useSyncExternalStore(noop, () => new Date().toDateString(), () => null);
  const hour = now ? new Date().getHours() : null;
  const today = now ? new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const empty = data && data.diaries.length === 0;

  return (
    <main className="flex flex-1 flex-col pb-24">
      <Header email={user?.email ?? null} today={today} />

      {/* Приветствие и главное действие дня */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-14 pt-10 sm:pt-16">
        <div className="min-h-[4.5rem] sm:min-h-[6rem]">
          {hour !== null && (
            <KineticTitle key={firstName ?? ''} lines={[`${greeting(hour)}${firstName ? `, ${firstName}` : ''}.`]}
              className="font-hand text-5xl leading-[1.05] sm:text-7xl" />
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-5" style={{ animation: 'pop-in 0.7s ease-out 0.7s both' }}>
          <p className="max-w-md text-2xl leading-snug text-muted">
            {empty ? 'Заведите первый дневник — и запишите в него сегодняшний день.' : 'Каким был сегодняшний день? Положите на доску всё, что запомнилось.'}
          </p>
          {data && <div className="flex flex-wrap items-center gap-3"><QuickDay diaries={data.diaries} /><ArchiveButton diaries={data.diaries} /></div>}
        </div>
      </section>

      {data && data.drafts.length > 0 && <Drafts drafts={data.drafts} />}

      <section aria-label="Ваши дневники" className="mt-4">
        <Desk />
      </section>

      {data && data.recent.length > 0 && <Recent days={data.recent} />}
    </main>
  );
}

function Header({ email, today }: { email: string | null; today: string }) {
  const router = useRouter();
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

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 pt-6">
      <Link href={AUTH_ROUTES.home} className="text-xl font-semibold tracking-tight">Дневник атмосферы</Link>
      <p className="ml-auto hidden text-lg text-muted first-letter:uppercase sm:block">{today}</p>
      {email ? (
        <div ref={box} className="relative">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="Профиль"
            className="grid h-11 w-11 place-items-center rounded-full bg-foreground text-lg text-background transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
            {email[0]?.toUpperCase()}
          </button>
          {open && (
            <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-64 rounded-lg bg-[#fbf8f1] text-[#2b241c] [--muted:#7a7064] [--foreground:#2b241c] p-2 shadow-2xl ring-1 ring-black/10" style={{ animation: 'pop-in 0.2s ease-out both' }}>
              <p className="truncate px-3 py-2 text-muted">{email}</p>
              <button type="button" role="menuitem" onClick={async () => { await signOut(); router.push('/'); }}
                className="w-full rounded-md px-3 py-2.5 text-left text-lg transition hover:bg-foreground/5 focus-visible:bg-foreground/5 focus-visible:outline-none">
                Выйти
              </button>
            </div>
          )}
        </div>
      ) : (
        <Link href={AUTH_ROUTES.login} className="ml-auto rounded-full border border-foreground/25 px-5 py-2 text-lg transition hover:bg-foreground hover:text-background sm:ml-0">Войти</Link>
      )}
    </header>
  );
}

/** Незаконченные доски: листок с полоской скотча, внутри — миниатюра того, что уже лежит на доске. */
function Drafts({ drafts }: { drafts: HomeDay[] }) {
  return (
    <section aria-labelledby="drafts-title" className="mx-auto mb-16 w-full max-w-6xl px-4">
      <div className="mb-5 flex flex-wrap items-baseline gap-x-4">
        <h2 id="drafts-title" className="text-3xl font-semibold">Продолжить</h2>
        <p className="font-hand text-2xl text-muted">доски, которые вы ещё не собрали в день</p>
      </div>
      <div className="-mx-4 flex snap-x gap-6 overflow-x-auto px-4 pb-4 pt-3 [scrollbar-width:thin]">
        {drafts.map((d, i) => <DraftCard key={d.day.id} item={d} tilt={[-1.5, 1, -0.5, 1.5][i % 4]} />)}
      </div>
    </section>
  );
}

function DraftCard({ item, tilt }: { item: HomeDay; tilt: number }) {
  const { day, diary } = item;
  const [board, setBoard] = useState<{ items: AnyItem[]; urls: Record<string, string> } | null>(null);
  useEffect(() => {
    let alive = true;
    api.dayBoard(day.id).then((r) => alive && setBoard({ items: r.board.items as AnyItem[], urls: r.urls }), () => alive && setBoard({ items: [], urls: {} }));
    return () => { alive = false; };
  }, [day.id]);
  const count = board?.items.length ?? 0;

  return (
    <Link href={`/day/${day.id}/board`} className="group relative block w-72 shrink-0 snap-start bg-[#fbf8f1] text-[#2b241c] [--muted:#7a7064] [--foreground:#2b241c] p-3 pb-4 shadow-md ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
      style={{ rotate: `${tilt}deg` }}>
      <span className="absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 rotate-[-2deg] bg-[#e8d9a8]/85" aria-hidden />
      {board && count > 0
        ? <BoardPreview items={board.items} urls={board.urls} height={150} />
        : <div className="grid h-[150px] place-items-center rounded-lg border-2 border-dashed border-foreground/15 font-hand text-2xl text-muted">{board ? 'пустая доска' : ''}</div>}
      <div className="mt-3 flex items-start gap-2.5">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ background: DIARY_KINDS[diary.kind].cover }} aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-lg leading-tight">{humanDate(day.date)}</p>
          <p className="truncate text-muted">{diary.title}{count ? `, на доске ${count}` : ''}</p>
        </div>
        <span className="ml-auto font-hand text-xl text-muted transition group-hover:text-foreground">дальше</span>
      </div>
    </Link>
  );
}

/** Недавние дни сохнут на верёвке, как отпечатки в проявочной. */
function Recent({ days }: { days: HomeDay[] }) {
  return (
    <section aria-labelledby="recent-title" className="mx-auto mt-20 w-full max-w-6xl px-4">
      <h2 id="recent-title" className="text-3xl font-semibold">Недавние дни</h2>
      <div className="relative -mx-4 mt-6 overflow-x-auto px-4 pb-6 [scrollbar-width:thin]">
        <div className="relative flex min-w-max gap-8 pt-8 sm:gap-10">
          {/* Верёвка чуть провисает между прищепками */}
          <svg className="pointer-events-none absolute inset-x-0 top-0 h-10 w-full" preserveAspectRatio="none" viewBox="0 0 100 10" aria-hidden>
            <path d="M0 3 Q25 9 50 5 T100 3" fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
          {days.map(({ day, diary }, i) => (
            <Link key={day.id} href={`/day/${day.id}`}
              className="group relative block w-40 shrink-0 origin-top transition-transform duration-500 hover:rotate-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground sm:w-44"
              style={{ rotate: `${[-2.5, 1.5, -1, 2.5, -1.8, 1][i % 6]}deg` }}>
              <span className="absolute -top-4 left-1/2 z-10 h-6 w-2.5 -translate-x-1/2 rounded-[2px] bg-[#8a6a4a] shadow-sm" aria-hidden />
              <div className="bg-[#fbf8f1] text-[#2b241c] [--muted:#7a7064] p-2 pb-3 shadow-lg ring-1 ring-black/5 transition group-hover:shadow-2xl">
                <div className="overflow-hidden" style={{ aspectRatio: '9 / 16', background: day.style?.palette.bg ?? '#e9e2d6' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {(day.posterUrl ?? day.photos[0]?.thumbUrl) && <img src={day.posterUrl ?? day.photos[0]?.thumbUrl} alt="" className="h-full w-full object-cover" />}
                </div>
                <p className="mt-2 line-clamp-2 text-lg leading-tight">{day.title ?? 'День'}</p>
                <p className="mt-0.5 truncate text-sm text-muted">{humanDate(day.date)}, {diary.title}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
