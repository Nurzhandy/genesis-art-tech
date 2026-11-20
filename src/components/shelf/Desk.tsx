'use client';
// «Стол» (спека 2026-11-20): свободное пространство, где лежат дневники человека, слот «+ новый дневник»
// и демо-дневник примером. Дневники лежат чуть вразнобой, как настоящие книги на столе.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { addToShelf, useShelf } from '@/lib/client/diaryKey';
import type { DiaryMeta } from '@/lib/shelf';
import { Tilt } from '@/components/fx/Tilt';
import { introEndsAt } from '@/components/fx/EntryIntro';
import { DiaryCover } from './DiaryCover';
import { NewDiaryDialog } from './NewDiaryDialog';
import { BookOpening, type OpeningFrom } from './BookOpening';

const tilt = (i: number) => [-3, 2, -1.5, 3.5, -2.5, 1][i % 6];
const DEMO = 'demo';

export function Desk() {
  const shelf = useShelf();
  const [metas, setMetas] = useState<DiaryMeta[] | null>(null);
  const [demo, setDemo] = useState<DiaryMeta | null>(null);
  const [dialog, setDialog] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [opening, setOpening] = useState<OpeningFrom | null>(null);
  const [delay, setDelay] = useState(0.1);   // сек: дневники падают на стол после заставки входа
  // Клик по дневнику: не переходим сразу, а сначала открываем книгу в 3D (Ctrl/⌘-клик — как обычная ссылка).
  const open = (meta: DiaryMeta, example = false) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setOpening({ meta, example, rect: e.currentTarget.getBoundingClientRect() });
  };
  const key = shelf?.join(',') ?? '';

  // Ссылка на всю полку с другого устройства: /?shelf=id1,id2
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('shelf');
    if (!p) return;
    const ids = p.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 50);
    if (ids.length && window.confirm(`Положить на полку этого устройства ${ids.length} дневник(ов)? Эта ссылка — ключ к ним: открывайте её только на своих устройствах.`)) ids.forEach(addToShelf);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  useEffect(() => {
    if (shelf === undefined) return;
    let alive = true;
    const ids = key ? key.split(',') : [];
    Promise.all([ids.length ? api.shelf(ids) : Promise.resolve([]), api.diary(DEMO).catch(() => null)]).then(
      ([m, d]) => { if (alive) { setDelay(Math.max(0.1, (introEndsAt - performance.now()) / 1000)); setMetas(m); setDemo(d); } },
      () => alive && setMetas([]),
    );
    return () => { alive = false; };
  }, [shelf, key]);

  const mine = (metas ?? []).filter((m) => m.id !== DEMO);

  return (
    <section id="desk" className="relative mx-auto w-full max-w-6xl px-4">
      <div className="relative min-h-[62vh] rounded-xl border border-foreground/10 p-6 sm:p-10"
        style={{ backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--foreground) 14%, transparent) 1px, transparent 1.4px)', backgroundSize: '22px 22px' }}>
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">ваш стол</p>
          {shelf && shelf.length > 1 && (
            <button type="button" className="font-mono text-[11px] uppercase tracking-wider text-muted underline-offset-4 hover:text-foreground hover:underline"
              onClick={async () => {
                const link = `${window.location.origin}/?shelf=${shelf.join(',')}`;
                try { await navigator.clipboard.writeText(link); window.alert('Ссылка на всю полку скопирована. Это ключ ко всем дневникам — храните её только у себя.'); }
                catch { window.prompt('Ссылка на всю полку (ключ ко всем дневникам):', link); }
              }}>🔑 ссылка на всю полку</button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
          {mine.map((m, i) => (
            <Link key={m.id} href={`/diary/${m.id}/board`} onClick={open(m)} className="group block"
              style={{ rotate: `${tilt(i)}deg`, opacity: opening?.meta.id === m.id ? 0 : undefined, animation: m.id === fresh ? 'polaroid-in 0.7s cubic-bezier(0.2,0.8,0.2,1.15) both' : `drop-in 0.8s cubic-bezier(0.2,0.8,0.2,1) ${delay + i * 0.09}s both` } as React.CSSProperties}>
              <Tilt className="rounded-md transition-transform duration-300 group-hover:-translate-y-2"><DiaryCover meta={m} /></Tilt>
            </Link>
          ))}

          <button type="button" onClick={() => setDialog(true)} data-ink
            className="group flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-foreground/25 text-muted transition hover:border-foreground/60 hover:text-foreground"
            style={{ rotate: `${tilt(mine.length)}deg`, animation: `drop-in 0.8s cubic-bezier(0.2,0.8,0.2,1) ${delay + mine.length * 0.09}s both` }}>
            <span className="text-5xl leading-none transition-transform duration-300 group-hover:rotate-90">+</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em]">новый дневник</span>
          </button>

          {demo && (
            <Link href={`/diary/${DEMO}/board`} onClick={open(demo, true)} className="group block opacity-80 transition-opacity hover:opacity-100"
              style={{ rotate: `${tilt(mine.length + 1)}deg`, animation: `drop-in 0.8s cubic-bezier(0.2,0.8,0.2,1) ${delay + 0.1 + mine.length * 0.09}s both` }}>
              <Tilt className="rounded-md transition-transform duration-300 group-hover:-translate-y-2"><DiaryCover meta={demo} example /></Tilt>
            </Link>
          )}
        </div>

        {metas && mine.length === 0 && (
          <p className="mt-10 max-w-md font-hand text-2xl text-muted">
            Здесь пока пусто. Заведите первый дневник — для воспоминаний, поездок, работы или идей.
          </p>
        )}
      </div>

      {/* Next сохраняет состояние стола при возврате «назад» — убираем оверлей после перехода, иначе он висел бы поверх. */}
      {opening && <BookOpening from={opening} onDone={() => setTimeout(() => setOpening(null), 700)} />}
      <NewDiaryDialog open={dialog} onClose={() => setDialog(false)}
        onCreated={(id) => { setDialog(false); setFresh(id); }} />
    </section>
  );
}
