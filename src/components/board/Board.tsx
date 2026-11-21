'use client';
// Свободная доска дневника (новая концепция 20.11): бесконечное пространство, как в Miro, но в духе дневника.
// Ядро (панорама, инструменты, отмена, автосохранение) — в BoardCanvas; здесь только то, что есть у дневника:
// карточки дней, которые собирает система, шапка с названием и «＋ день».
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { useIsMyDiary } from '@/lib/client/diaryKey';
import { placeMissingDays } from '@/lib/board/board';
import type { DayRecord } from '@/lib/types';
import { BoardCanvas } from './BoardCanvas';
import { daysWithDrafts, isBoardDraft } from '@/lib/client/dayBoard';
import { NewDayButton } from '../dayboard/NewDayButton';

const pill = 'rounded-full bg-background/80 px-3 py-2 font-mono text-[11px] uppercase tracking-wider shadow-sm backdrop-blur hover:bg-background';

export function Board({ diaryId, title, cover, opened }: { diaryId: string; title: string; cover: string; opened: boolean }) {
  const mine = useIsMyDiary(diaryId);
  const [days, setDays] = useState<Map<string, DayRecord>>(new Map());

  return (
    <BoardCanvas
      editable={mine}
      opened={opened}
      // Загрузка: доска + дни дневника. Новые дни сами ложатся на доску.
      load={async () => {
        const [b, list] = await Promise.all([api.board(diaryId), daysWithDrafts(diaryId).catch(() => api.listDays(diaryId))]);
        setDays(new Map(list.map((d) => [d.id, d])));
        return { items: placeMissingDays(b.board, list.map((d) => d.id)).items, urls: b.urls };
      }}
      save={(board) => api.saveBoard(diaryId, board)}
      upload={(ext) => api.boardUpload(diaryId, ext)}
      header={<>
        <Link href="/" className="rounded-full bg-background/80 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-muted shadow-sm backdrop-blur hover:text-foreground">← стол</Link>
        <div className="flex min-w-0 items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur">
          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: cover }} />
          <h1 className="max-w-[40vw] truncate text-lg font-semibold">{title}</h1>
        </div>
      </>}
      headerRight={<>
        <Link href={`/diary/${diaryId}/book`} className={pill}>📖 книга</Link>
        <Link href={`/diary/${diaryId}`} className={pill}>архив</Link>
      </>}
      primary={<NewDayButton diaryId={diaryId} className="ml-1 shrink-0 rounded-full bg-foreground px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-background disabled:opacity-60" />}
      empty={
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6 text-center" style={{ animation: 'pop-in 0.8s ease-out 0.3s both' }}>
          <p className="font-hand text-4xl opacity-70">Это ваше свободное пространство</p>
          <div className="flex flex-wrap justify-center gap-4 font-mono text-[11px] uppercase tracking-wider opacity-60">
            <span className="rounded-md border-2 border-dashed border-current px-5 py-6">двойной щелчок —<br />заметка</span>
            <span className="rounded-md border-2 border-dashed border-current px-5 py-6">перетащите сюда<br />фото</span>
            <span className="rounded-md border-2 border-dashed border-current px-5 py-6">🎙 удерживайте —<br />голосовое</span>
            <span className="rounded-md border-2 border-dashed border-current px-5 py-6">«+ день» — система<br />соберёт воспоминание</span>
          </div>
        </div>
      }
      // Карточка дня — собирает наша система.
      renderItem={(it) => {
        if (it.kind !== 'day') return null;
        const d = days.get(it.dayId);
        const img = d?.posterUrl ?? d?.photos[0]?.thumbUrl;
        const draftDay = d ? isBoardDraft(d) : false;
        return (
          <div className="group/day">
            <div className="relative overflow-hidden rounded-sm shadow-2xl ring-1 ring-black/10" style={{ aspectRatio: '9 / 16', background: d?.style?.palette.bg ?? '#e9e2d6' }}>
              {d?.sealed ? <div className="flex h-full items-center justify-center bg-[#e8dcc4] font-hand text-2xl text-[#4a3a28]">✉ капсула</div>
                // eslint-disable-next-line @next/next/no-img-element
                : img ? <img src={img} alt={d?.title ?? ''} draggable={false} className="h-full w-full object-cover" />
                : draftDay ? <div className="flex h-full items-center justify-center border-2 border-dashed border-[#2b241c]/25 font-hand text-2xl text-[#2b241c]/60">черновик</div> : null}
              <Link href={draftDay ? `/day/${it.dayId}/board` : `/day/${it.dayId}`} onPointerDown={(e) => e.stopPropagation()}
                className="absolute inset-x-2 bottom-2 rounded-full bg-black/55 px-3 py-1.5 text-center font-mono text-[10px] uppercase tracking-wider text-white opacity-0 backdrop-blur transition group-hover/day:opacity-100">{draftDay ? 'продолжить доску →' : 'открыть день →'}</Link>
            </div>
            <p className="mt-2 text-lg leading-tight">{draftDay ? 'Черновик дня' : d?.title ?? '…'}</p>
            <p className="font-mono text-[10px] opacity-60">{d?.date.split('-').reverse().join('.')}</p>
          </div>
        );
      }}
    />
  );
}
