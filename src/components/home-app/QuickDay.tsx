'use client';
// Быстрый «＋ день» с главной (план 21.11, часть B): один дневник — сразу черновик и доска дня,
// несколько — сначала выбрать, в какой дневник записать день.
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { localToday } from '@/lib/archive';
import { api } from '@/lib/client/api';
import { DIARY_KINDS, type DiaryMeta } from '@/lib/shelf';

export function QuickDay({ diaries }: { diaries: DiaryMeta[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [choose, setChoose] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!choose) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setChoose(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', close); };
  }, [choose]);

  async function start(diaryId: string) {
    if (busy) return;
    setBusy(diaryId);
    try {
      const { dayId } = await api.createDraftDay(diaryId, localToday());
      router.push(`/day/${dayId}/board`);
    } catch {
      // Сервер ещё не умеет черновики или дневник только для чтения — простая форма.
      router.push(`/diary/${diaryId}/new`);
    }
  }

  if (!diaries.length) return null;

  return (
    <div ref={box} className="relative">
      <button type="button" data-magnetic aria-haspopup={diaries.length > 1 ? 'menu' : undefined} aria-expanded={diaries.length > 1 ? choose : undefined}
        onClick={() => (diaries.length === 1 ? start(diaries[0].id) : setChoose((v) => !v))} disabled={!!busy}
        className="rounded-full bg-foreground px-7 py-3.5 text-lg text-background shadow-[0_10px_30px_-12px_rgba(31,27,22,0.6)] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground disabled:opacity-60">
        {busy ? 'Раскладываю доску…' : '＋ Записать день'}
      </button>

      {choose && (
        <div role="menu" className="absolute left-0 top-full z-30 mt-3 w-72 rounded-lg bg-[#fbf8f1] text-[#2b241c] [--muted:#7a7064] [--foreground:#2b241c] p-2 shadow-2xl ring-1 ring-black/10"
          style={{ animation: 'pop-in 0.25s ease-out both' }}>
          <p className="px-3 pb-1 pt-2 font-hand text-xl text-muted">В какой дневник?</p>
          {diaries.map((d) => (
            <button key={d.id} type="button" role="menuitem" onClick={() => start(d.id)} disabled={!!busy}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition hover:bg-foreground/5 focus-visible:bg-foreground/5 focus-visible:outline-none">
              <span className="grid h-9 w-7 shrink-0 place-items-center rounded-sm text-sm text-white shadow-sm" style={{ background: DIARY_KINDS[d.kind].cover }} aria-hidden>
                {DIARY_KINDS[d.kind].icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg leading-tight">{d.title}</span>
                <span className="block text-sm text-muted">{busy === d.id ? 'открываю доску…' : `${d.dayCount} ${plural(d.dayCount)}`}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const plural = (n: number) => {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return 'день';
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'дня';
  return 'дней';
};
