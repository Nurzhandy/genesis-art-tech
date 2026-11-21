'use client';
// «Доска дня» на странице дня (план 21.11, человек 3): то, что человек собрал руками, под живой страницей.
// Для владельца — «изменить доску» и «пересобрать день» (оба ведут на доску, там же кнопка пересборки).
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import type { AnyItem } from '@/lib/dayboard/layout';
import { BoardPreview } from './BoardPreview';

export function DayBoardSection({ dayId, mine }: { dayId: string; mine: boolean }) {
  const [data, setData] = useState<{ items: AnyItem[]; urls: Record<string, string> } | null>(null);
  useEffect(() => {
    let alive = true;
    api.dayBoard(dayId)
      .then((r) => alive && setData({ items: r.board.items, urls: r.urls }))
      .catch(() => alive && setData({ items: [], urls: {} })); // старый день без доски или роут ещё не выкачен
    return () => { alive = false; };
  }, [dayId]);
  if (!data?.items.length) return null;
  return (
    <section className="flex flex-col gap-3" aria-label="Доска дня">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Доска дня · собрано руками</h2>
        {mine && (
          <div className="flex gap-2">
            <Link href={`/day/${dayId}/board`} className="rounded-full border border-foreground/30 px-4 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors hover:bg-foreground hover:text-background">✎ изменить доску</Link>
            <Link href={`/day/${dayId}/board?reassemble=1`} className="rounded-full border border-foreground/30 px-4 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors hover:bg-foreground hover:text-background">↻ пересобрать день</Link>
          </div>
        )}
      </div>
      <BoardPreview items={data.items} urls={data.urls} />
    </section>
  );
}
