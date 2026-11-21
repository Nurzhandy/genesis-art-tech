'use client';
// Низ доски дня (план 21.11, человек 3): «Собрать день» / «Пересобрать день» и запасной путь «простая форма».
// Стоит на панели доски дня (слот primary в DayBoard), см. DayBoardPage.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/client/api';
import type { PhotoFeatures } from '@/lib/types';
import { extractCoverPalette } from '@/lib/client/coverPalette';
import { shotHour } from '@/lib/client/exif';
import { processPhoto } from '@/lib/client/imageProcess';
import { assemblyPicks, hasMaterial, type AnyItem } from '@/lib/dayboard/layout';
import type { BoardItem } from '@/lib/board/board';
import { AssembleAnimation } from './AssembleAnimation';

const MIN_SHOW_MS = 2600; // анимации нужно время, даже если сервер ответил быстро

type AssembleBody = Parameters<typeof api.assembleDay>[1];

/** Нейтральные признаки, если фото не открылось: сервер ждёт ровно столько признаков, сколько фото на доске. */
const neutral = (index: number): PhotoFeatures => ({ index, width: 1200, height: 1600, palette: ['#9a8f80', '#c9bfae', '#5e564b', '#e7dfd1', '#3b352e'], brightness: 0.5, warmth: 0, saturation: 0.3 });

/** Признаки, которые браузер считает сам: цвета и свет фото (в порядке collectDay), темп и лад первой песни. */
export async function prepareAssembly(items: AnyItem[], urls: Record<string, string>, date: string): Promise<AssembleBody> {
  const picks = assemblyPicks(items);
  const photos = await Promise.all(picks.photos.map(async (p, i) => {
    const src = urls[p.path];
    try {
      if (!src) throw new Error('нет ссылки');
      const blob = await (await fetch(src)).blob();
      const done = await processPhoto(new File([blob], `board-${i}.jpg`, { type: blob.type || 'image/jpeg' }), i);
      return { features: done.features, takenAt: done.takenAt };
    } catch { return { features: neutral(i), takenAt: null }; }
  }));
  const [music, coverPalette] = picks.song ? await Promise.all([
    api.resolveSong(picks.song.url).then((r) => r.music).catch(() => null),
    extractCoverPalette(picks.song.cover).catch(() => undefined),
  ]) : [null, undefined];
  const hour = shotHour(photos.map((p) => p.takenAt), date);
  return {
    photoFeatures: photos.map((p) => p.features), music,
    ...(coverPalette ? { coverPalette } : {}), ...(hour !== undefined ? { photoHour: hour } : {}), date,
  };
}

export function AssembleBar({ dayId, diaryId, date, place, items, assembled = false }: {
  /** date и place — из шапки доски (их можно сменить), уходят в сборку. */
  dayId: string; diaryId: string; date: string; place?: string; items: AnyItem[];
  /** День уже собирали: кнопка становится «Пересобрать день». */
  assembled?: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const [snapshot, setSnapshot] = useState<AnyItem[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  async function assemble() {
    if (!hasMaterial(items)) {
      setNote({ text: 'Положите на доску хоть что-то: заметку (двойной щелчок), голосовое 🎙, фото или песню ♪ — и соберём день.', error: false });
      return;
    }
    setNote(null);
    setSnapshot(items);
    setRunning(true);
    setDone(false);
    const started = Date.now();
    try {
      // Автосохранение доски отложено: сохраняем то, что видит человек, и берём свежие ссылки на фото.
      await api.saveDayBoard(dayId, { v: 1, items: items as BoardItem[] });
      const fresh = await api.dayBoard(dayId);
      setUrls(fresh.urls);
      await api.assembleDay(dayId, { ...(await prepareAssembly(items, fresh.urls, date)), ...(place !== undefined ? { place } : {}) });
      await new Promise((r) => setTimeout(r, Math.max(0, MIN_SHOW_MS - (Date.now() - started))));
      setDone(true);
    } catch (e) {
      setRunning(false);
      setNote({ text: e instanceof Error ? e.message : 'Не получилось собрать день', error: true });
    }
  }

  const finish = useCallback(() => router.push(`/day/${dayId}`), [router, dayId]);

  return (
    <>
      {/* Кнопка стоит внутри панели доски (backdrop-blur + прокрутка): fixed там обрезается панелью,
          поэтому анимация и подсказка рисуются прямо в body. */}
      {running && createPortal(<div className="contents [--background:#f6f1e8] [--foreground:#2b241c] [--muted:#7a7064] text-[#2b241c]"><AssembleAnimation items={snapshot} urls={urls} done={done} onDone={finish} /></div>, document.body)}
      {note && createPortal(<div className="contents [--background:#f6f1e8] [--foreground:#2b241c] [--muted:#7a7064] text-[#2b241c]">
        <p role="alert" onClick={() => setNote(null)}
          className={`fixed inset-x-4 bottom-24 z-30 mx-auto max-w-sm rounded-2xl bg-background/95 px-4 py-2.5 text-center text-sm shadow-xl ring-1 ring-black/5 backdrop-blur ${note.error ? 'text-red-700' : ''}`}>
          {note.text}
        </p></div>, document.body,
      )}
      <button type="button" onClick={assemble} disabled={running} data-magnetic
        className="ml-1 shrink-0 rounded-full bg-foreground px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-background transition hover:scale-[1.03] disabled:opacity-60">
        ✦ {assembled ? 'Пересобрать день' : 'Собрать день'}
      </button>
      <Link href={`/diary/${diaryId}/new`} title="Старая форма с полями" className="shrink-0 px-2 font-mono text-[10px] uppercase tracking-wider text-muted underline decoration-dotted underline-offset-4 hover:text-foreground">
        простая форма
      </Link>
    </>
  );
}
