'use client';
// «Год в цветах» (план 20.11, C4): каждая клетка — день, цвет — главный цвет его воспоминания.
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { humanDate } from '@/lib/archive';
import type { DayRecord } from '@/lib/types';
import { songOfYear, warmestWeek, yearDays, yearGrid, yearsOf, type YearCell } from '@/lib/year';
import { download } from '@/render/exportDay';
import { YearMosaic } from './YearMosaic';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const shortDate = (d: string) => humanDate(d).replace(/ \d{4}$/, '');

/** PNG 1080×1350 для сторис и печати: та же сетка, подписи и итоги года. */
async function yearPng(grid: YearCell[][], year: number, lines: string[]): Promise<Blob> {
  const W = 1080, H = 1350, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const css = (v: string, f: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || f;
  const serif = css('--font-cormorant', 'Georgia, serif'), mono = css('--font-jetbrains', 'monospace');
  await document.fonts.load(`600 80px ${serif}`, 'год').catch(() => undefined);
  g.fillStyle = '#f4efe6'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#2b241c';
  g.font = `600 96px ${serif}`; g.fillText(String(year), 80, 170);
  g.font = `400 44px ${serif}`; g.fillText('год в цветах', 80, 230);
  const x0 = 150, y0 = 300, cell = 26, gap = 2;
  g.font = `500 20px ${mono}`;
  grid.forEach((row, m) => {
    g.fillStyle = '#8a7d6b';
    g.fillText(MONTHS[m], 80, y0 + m * (cell + gap) * 2.2 + cell * 0.75);
    row.forEach((cl, d) => {
      if (!cl.inMonth) return;
      g.fillStyle = cl.color ?? 'rgba(43,36,28,0.07)';
      g.beginPath();
      g.roundRect(x0 + d * (cell + gap), y0 + m * (cell + gap) * 2.2, cell, cell * 1.6, 4);
      g.fill();
    });
  });
  g.fillStyle = '#2b241c'; g.font = `400 34px ${serif}`;
  lines.forEach((l, i) => g.fillText(l, 80, 1150 + i * 50));
  g.fillStyle = '#8a7d6b'; g.font = `500 18px ${mono}`; g.fillText('ДНЕВНИК АТМОСФЕРЫ', 80, H - 50);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Не удалось сохранить картинку'))), 'image/png'));
}

export function YearView({ diaryId, year }: { diaryId: string; year: number }) {
  const [days, setDays] = useState<DayRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'mosaic' | 'grid'>('mosaic');
  useEffect(() => {
    let alive = true;
    api.listDays(diaryId).then((d) => alive && setDays(d), (e) => alive && setError(e instanceof Error ? e.message : 'Не удалось открыть дневник'));
    return () => { alive = false; };
  }, [diaryId]);

  const data = useMemo(() => {
    if (!days) return null;
    const list = yearDays(days, year);
    return { list, grid: yearGrid(days, year), song: songOfYear(list), warm: warmestWeek(list), years: yearsOf(days) };
  }, [days, year]);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="font-mono text-xs text-muted">раскладываю год…</p>;
  const lines = [
    `${data.list.length} ${data.list.length % 10 === 1 && data.list.length % 100 !== 11 ? 'день' : [2, 3, 4].includes(data.list.length % 10) && ![12, 13, 14].includes(data.list.length % 100) ? 'дня' : 'дней'} в дневнике`,
    data.song ? `песня года: ${data.song.label} (${data.song.count} дн.)` : null,
    data.warm ? `самая тёплая неделя: ${shortDate(data.warm.start)} — ${shortDate(data.warm.end)}` : null,
  ].filter((l): l is string => !!l);

  return (
    <div>
      {data.years.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2 font-mono text-xs">
          {data.years.map((y) => (
            <Link key={y} href={`/diary/${diaryId}/year/${y}`}
              className={`rounded-full px-3 py-1 ${y === year ? 'bg-foreground text-background' : 'border border-foreground/20 text-muted hover:text-foreground'}`}>{y}</Link>
          ))}
        </div>
      )}
      <div className="mb-4 inline-flex rounded-full border border-foreground/20 p-0.5 font-mono text-xs" role="tablist">
        {([['mosaic', 'мозаика'], ['grid', 'сетка']] as const).map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={`rounded-full px-3 py-1 ${mode === m ? 'bg-foreground text-background' : 'text-muted hover:text-foreground'}`}>{label}</button>
        ))}
      </div>
      {mode === 'mosaic' && <YearMosaic grid={data.grid} days={data.list} />}
      <div className={`overflow-x-auto pb-4 ${mode === 'mosaic' ? 'hidden' : ''}`}>
        <div className="inline-grid min-w-[640px] grid-cols-[36px_repeat(31,minmax(14px,1fr))] gap-[3px]">
          <span />
          {Array.from({ length: 31 }, (_, i) => <span key={i} className="text-center font-mono text-[9px] text-muted">{(i + 1) % 5 === 0 || i === 0 ? i + 1 : ''}</span>)}
          {data.grid.map((row, m) => [
            <span key={`m${m}`} className="self-center font-mono text-[10px] uppercase text-muted">{MONTHS[m]}</span>,
            ...row.map((c) => !c.inMonth ? <span key={c.date} />
              : c.dayId ? (
                <Link key={c.date} href={`/day/${c.dayId}`} title={`${humanDate(c.date)} · ${c.title}${c.count > 1 ? ` (+${c.count - 1})` : ''}`}
                  className="aspect-[3/4] rounded-[3px] ring-1 ring-black/10 transition hover:scale-125" style={{ background: c.color ?? undefined }} />
              ) : <span key={c.date} className="aspect-[3/4] rounded-[3px] bg-foreground/[0.06]" title={humanDate(c.date)} />),
          ])}
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-2 text-xl">
        {lines.map((l) => <p key={l}>{l}</p>)}
        {data.list.length === 0 && <p className="text-muted">В этом году дней пока нет.</p>}
      </div>
      {data.list.length > 0 && (
        <button type="button" onClick={async () => download(await yearPng(data.grid, year, lines), `${year} в цветах.png`)}
          className="mt-6 rounded-full border border-foreground/30 px-5 py-2.5 font-mono text-xs uppercase tracking-wider transition hover:bg-foreground hover:text-background">
          ↓ Скачать картинку
        </button>
      )}
      <p className="mt-8 max-w-xl text-sm text-muted">Цвет клетки — главный цвет воспоминания дня. Это палитра ваших фото, песен и погоды, а не оценка настроения.</p>
    </div>
  );
}
