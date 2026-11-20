'use client';
import { playPageFlip } from '@/lib/sound/player';
// Режим «Книга» (ресерч S1, docs/research/scrapbook-flipbook.md): дневник листается как настоящая книга.
// Обложка — в среднем цвете всех дней; на развороте слева воспоминание дня, справа запись от руки.
// Листание — библиотека StPageFlip (page-flip). Она переносит страницы в свой DOM, поэтому React рисует
// страницы в скрытый шаблон, а книге отдаются их копии: дерево React и книга не мешают друг другу.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { averageColor, bookPages } from '@/lib/archive';
import type { DayRecord } from '@/lib/types';

const NARROW = '(max-width: 760px)';
function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

const PAGE_W = 420;
const PAGE_H = 620;

function excerpt(text: string, max = 420): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf('. ') + 1, cut.lastIndexOf(' '))) + '…';
}

const fmt = (d: string) => d.split('-').reverse().join('.');

export function BookView({ days, title }: { days: DayRecord[]; title: string }) {
  const host = useRef<HTMLDivElement>(null);
  const template = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const flipRef = useRef<import('page-flip').PageFlip | null>(null);
  const ordered = useMemo(() => bookPages(days), [days]);
  const cover = useMemo(() => averageColor(days), [days]);
  // Книга сама не перестраивает разворот при повороте экрана — пересобираем её при смене ширины.
  const narrow = useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);
  const key = `${narrow}|` + ordered.map((d) => `${d.id}:${d.posterUrl ? 1 : 0}:${d.title}`).join('|');

  useEffect(() => {
    let cancelled = false;
    let flip: import('page-flip').PageFlip | null = null;
    const mount = document.createElement('div');
    // Кадр ожидания: после поворота экрана книга должна мерить уже новую ширину.
    // setTimeout, а не requestAnimationFrame: в фоновой вкладке кадры не идут, и книга не открылась бы.
    const nextFrame = () => new Promise((r) => setTimeout(r, 60));
    Promise.all([import('page-flip'), nextFrame()]).then(([{ PageFlip }]) => {
      if (cancelled || !host.current || !template.current) return;
      host.current.appendChild(mount);
      const pages = Array.from(template.current.children).map((n) => n.cloneNode(true) as HTMLElement);
      flip = new PageFlip(mount, {
        width: PAGE_W, height: PAGE_H, size: 'stretch',
        // Разворот помещается в экран ноутбука; на телефоне книга становится одностраничной.
        minWidth: 240, maxWidth: 440, minHeight: 360, maxHeight: 650,
        showCover: true, maxShadowOpacity: 0.45, flippingTime: 900, mobileScrollSupport: true, usePortrait: true,
      });
      flip.loadFromHTML(pages);
      flip.on('flip', (e) => setPage(Number(e.data)));
      // Шорох страницы в начале перелистывания (план 20.11, B4).
      flip.on('changeState', (e) => { if (e.data === 'flipping') playPageFlip(); });
      flipRef.current = flip;
      setTotal(pages.length);
    });
    return () => {
      cancelled = true;
      flip?.destroy();
      flipRef.current = null;
      mount.remove();
    };
  }, [key]);

  return (
    <div>
      <div ref={host} className="mx-auto w-full max-w-[1120px] [&_.stf__parent]:mx-auto" />
      <div className="mt-6 flex items-center justify-center gap-4 font-mono text-xs text-muted">
        <button type="button" onClick={() => flipRef.current?.flipPrev()} disabled={page === 0}
          className="rounded-full border border-foreground/20 px-3 py-1.5 transition hover:border-foreground/50 hover:text-foreground disabled:opacity-30">← назад</button>
        <span>{total ? `${Math.min(page + 1, total)} / ${total}` : 'открываю книгу…'}</span>
        <button type="button" onClick={() => flipRef.current?.flipNext()} disabled={total > 0 && page >= total - 1}
          className="rounded-full border border-foreground/20 px-3 py-1.5 transition hover:border-foreground/50 hover:text-foreground disabled:opacity-30">вперёд →</button>
      </div>
      <p className="mt-2 text-center font-mono text-[11px] text-muted">листайте мышью за угол страницы или свайпом</p>

      {/* Шаблон страниц: из него книга берёт копии. Сам он не виден. */}
      <div ref={template} hidden aria-hidden>
        {/* Обложка */}
        <div data-density="hard" className="h-full w-full">
          <div className="flex h-full w-full flex-col justify-between p-10 text-white shadow-inner"
            style={{ background: `linear-gradient(135deg, ${cover}, ${cover}cc), ${cover}` }}>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] opacity-80">дневник атмосферы</p>
            <div>
              <p className="text-5xl font-semibold leading-[0.95] [text-shadow:0_1px_8px_rgba(0,0,0,0.35)]">{title}</p>
              <p className="mt-3 font-hand text-2xl opacity-90">{ordered.length} {ordered.length === 1 ? 'день' : ordered.length < 5 ? 'дня' : 'дней'}
                {ordered.length ? ` · ${fmt(ordered[0].date)} — ${fmt(ordered[ordered.length - 1].date)}` : ''}</p>
            </div>
            <div className="flex gap-1.5">
              {ordered.slice(0, 12).map((d) => <span key={d.id} className="h-3 w-3 rounded-full ring-1 ring-white/60" style={{ background: d.style?.palette.accents[0] ?? '#fff' }} />)}
            </div>
          </div>
        </div>

        {ordered.flatMap((d) => {
          const ink = d.style?.palette.ink ?? '#1f1b16';
          const paper = d.style?.palette.paper ?? '#f4efe6';
          const img = d.posterUrl ?? d.photos[0]?.thumbUrl;
          return [
            <div key={`${d.id}-l`} className="h-full w-full">
              <div className="h-full w-full p-4" style={{ background: d.style?.palette.bg ?? '#e9e2d6' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img && <img src={img} alt={`Воспоминание дня «${d.title}»`} className="h-full w-full rounded-sm object-cover shadow-md" />}
              </div>
            </div>,
            <div key={`${d.id}-r`} className="h-full w-full">
              <div className="flex h-full w-full flex-col p-8" style={{ background: paper, color: ink }}>
                <p className="font-mono text-[11px] uppercase tracking-[0.25em] opacity-70">{fmt(d.date)}</p>
                <h3 className="mt-2 text-3xl font-semibold leading-tight">{d.title}</h3>
                {d.analysis?.caption && <p className="mt-2 font-hand text-2xl leading-tight opacity-90">«{d.analysis.caption}»</p>}
                <p className="mt-4 flex-1 overflow-hidden font-hand text-[22px] leading-snug opacity-85">{excerpt(d.text)}</p>
                <div className="mt-4 flex items-end justify-between gap-3 border-t pt-3 font-mono text-[11px]" style={{ borderColor: `${ink}33` }}>
                  <span className="min-w-0 truncate opacity-70">{[d.song.artist, d.song.title].filter(Boolean).join(' — ') ? `♪ ${[d.song.artist, d.song.title].filter(Boolean).join(' — ')}` : '♪ песня дня'}</span>
                  <a href={`/day/${d.id}`} className="shrink-0 underline underline-offset-4">открыть день →</a>
                </div>
              </div>
            </div>,
          ];
        })}

        {/* Задняя обложка */}
        <div data-density="hard" className="h-full w-full">
          <div className="flex h-full w-full items-end justify-center p-10 text-white" style={{ background: cover }}>
            <p className="font-hand text-2xl opacity-90">продолжение следует…</p>
          </div>
        </div>
      </div>
    </div>
  );
}
