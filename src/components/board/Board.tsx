'use client';
// Свободная доска дневника (новая концепция 20.11): бесконечное пространство, как в Miro, но в духе дневника.
// Двигать — перетаскивать фон, приближать — колесо. Двойной щелчок — заметка. Всё сохраняется само.
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type SignedUpload } from '@/lib/client/api';
import { useIsMyDiary } from '@/lib/client/diaryKey';
import { processPhoto } from '@/lib/client/imageProcess';
import { STICKER_SHAPES, type StickerShape } from '@/lib/decor/decor';
import { SHAPE_NAMES } from '@/lib/decor/shapes';
import { placeMissingDays, type BoardItem } from '@/lib/board/board';
import type { DayRecord } from '@/lib/types';
import { StickerIcon } from '../decor/StickerIcon';

type Tool = 'select' | 'note' | 'pen' | 'arrow' | 'frame';
interface View { x: number; y: number; s: number }

const COLORS = ['#2b241c', '#f4efe6', '#c8892b', '#b5653a', '#7a3b2e', '#2f6f73', '#3d4b6b', '#7a4a6a', '#8a9a5b', '#e0b84d'];
const uid = () => Math.random().toString(36).slice(2, 10);
const iconBtn = 'group relative grid h-11 w-11 place-items-center rounded-full text-lg transition hover:bg-foreground/10 disabled:opacity-30';

function Tip({ children }: { children: string }) {
  return <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 font-mono text-[10px] text-background opacity-0 transition group-hover:opacity-100">{children}</span>;
}

function strokePath(p: number[]) {
  if (p.length < 4) return `M${p[0]} ${p[1]} l0.1 0`;
  let d = `M${p[0]} ${p[1]}`;
  for (let i = 2; i < p.length - 2; i += 2) d += ` Q${p[i]} ${p[i + 1]} ${(p[i] + p[i + 2]) / 2} ${(p[i + 1] + p[i + 3]) / 2}`;
  return `${d} L${p[p.length - 2]} ${p[p.length - 1]}`;
}

export function Board({ diaryId, title, cover, opened }: { diaryId: string; title: string; cover: string; opened: boolean }) {
  const mine = useIsMyDiary(diaryId);
  const [items, setItems] = useState<BoardItem[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [days, setDays] = useState<Map<string, DayRecord>>(new Map());
  const [view, setView] = useState<View>({ x: 0, y: 0, s: opened ? 0.6 : 1 });
  const [anim, setAnim] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState(COLORS[0]);
  const [glow, setGlow] = useState(false);
  const [width, setWidth] = useState(4);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [stickers, setStickers] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [history, setHistory] = useState<BoardItem[][]>([]);
  const [draft, setDraft] = useState<BoardItem | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const action = useRef<{ type: 'pan' | 'move' | 'resize' | 'draw'; sx: number; sy: number; vx: number; vy: number; id?: string; ox?: number; oy?: number; ow?: number } | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const loaded = useRef(false);

  // Загрузка: доска + дни дневника. Новые дни сами ложатся на доску.
  useEffect(() => {
    let alive = true;
    Promise.all([api.board(diaryId), api.listDays(diaryId)]).then(([b, list]) => {
      if (!alive) return;
      const placed = placeMissingDays(b.board, list.map((d) => d.id));
      setUrls(b.urls);
      setDays(new Map(list.map((d) => [d.id, d])));
      setItems(placed.items);
      fit(placed.items, opened);
    }).catch(() => alive && setItems([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diaryId]);

  // Камера «влетает» в доску и показывает всё, что на ней лежит.
  function fit(list: BoardItem[], fly: boolean) {
    const el = wrap.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    if (!list.length) { setView({ x: W / 2, y: H / 2, s: 1 }); return; }
    const bs = list.map(bounds);
    const xs = bs.flatMap((b) => [b.x, b.x + b.w]), ys = bs.flatMap((b) => [b.y, b.y + b.h]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const s = Math.min(1.2, Math.max(0.15, Math.min((W - 160) / (maxX - minX || 1), (H - 220) / (maxY - minY || 1))));
    const target = { s, x: W / 2 - ((minX + maxX) / 2) * s, y: H / 2 - ((minY + maxY) / 2) * s + 10 };
    if (fly) {
      setView({ ...target, s: s * 0.6 });   // продолжаем наезд камеры из книги
      requestAnimationFrame(() => { setAnim(true); setView(target); setTimeout(() => setAnim(false), 1300); });
    } else setView(target);
  }

  // Автосохранение через 800 мс после изменения.
  useEffect(() => {
    if (!items || !mine) return;
    if (!loaded.current) { loaded.current = true; return; }
    setSaving('saving');
    const t = setTimeout(() => {
      api.saveBoard(diaryId, { v: 1, items }).then(() => setSaving('saved'), () => setSaving('error'));
    }, 800);
    return () => clearTimeout(t);
  }, [items, mine, diaryId]);

  const commit = useCallback((next: BoardItem[]) => {
    setHistory((h) => [...h.slice(-40), items ?? []]);
    setItems(next);
  }, [items]);
  const update = (id: string, patch: Partial<BoardItem>) => setItems((list) => list?.map((i) => (i.id === id ? ({ ...i, ...patch } as BoardItem) : i)) ?? list);
  const remove = (id: string) => { commit((items ?? []).filter((i) => i.id !== id)); setSelected(null); };
  const undo = () => { const prev = history[history.length - 1]; if (!prev) return; setHistory((h) => h.slice(0, -1)); setItems(prev); };

  const toBoard = (cx: number, cy: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: (cx - r.left - view.x) / view.s, y: (cy - r.top - view.y) / view.s };
  };
  const center = () => { const el = wrap.current!; return toBoard(el.getBoundingClientRect().left + el.clientWidth / 2, el.getBoundingClientRect().top + el.clientHeight / 2); };
  const add = (it: BoardItem) => { commit([...(items ?? []), it]); setSelected(it.id); setTool('select'); };
  const tilt = () => Math.round(Math.random() * 6 - 3);

  // Колесо — приблизить к курсору (не пассивный слушатель, чтобы страница не прокручивалась).
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      setView((v) => {
        if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return { ...v, x: v.x - e.deltaX, y: v.y - e.deltaY };
        const s = Math.min(4, Math.max(0.1, v.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
        return { s, x: px - ((px - v.x) / v.s) * s, y: py - ((py - v.y) / v.s) * s };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && mine) { e.preventDefault(); remove(selected); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && mine) { e.preventDefault(); undo(); }
      if (e.key === 'Escape') { setSelected(null); setEditing(null); setTool('select'); setStickers(false); }
      const keys: Record<string, Tool> = { v: 'select', n: 'note', p: 'pen', a: 'arrow', f: 'frame' };
      if (mine && !e.metaKey && !e.ctrlKey && keys[e.key.toLowerCase()]) setTool(keys[e.key.toLowerCase()]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function onBgDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelected(null); setEditing(null); setStickers(false);
    const p = toBoard(e.clientX, e.clientY);
    if (!mine || tool === 'select') { action.current = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; return; }
    if (tool === 'note') {
      const it: BoardItem = { id: uid(), kind: 'note', x: p.x - 110, y: p.y - 30, rot: tilt(), text: '', w: 240, color, font: 'hand' };
      add(it); setEditing(it.id); return;
    }
    const id = uid();
    if (tool === 'pen') setDraft({ id, kind: 'stroke', x: 0, y: 0, rot: 0, points: [Math.round(p.x), Math.round(p.y)], width, color, ...(glow ? { glow } : {}) });
    if (tool === 'arrow') setDraft({ id, kind: 'arrow', x: p.x, y: p.y, rot: 0, x2: p.x, y2: p.y, color, width: 3 });
    if (tool === 'frame') setDraft({ id, kind: 'frame', x: p.x, y: p.y, rot: 0, w: 100, h: 100, title: 'Новая страница', color: '#2b241c' });
    action.current = { type: 'draw', sx: p.x, sy: p.y, vx: 0, vy: 0 };
  }

  function onMove(e: React.PointerEvent) {
    const a = action.current;
    if (!a) return;
    if (a.type === 'pan') { setView((v) => ({ ...v, x: a.vx + e.clientX - a.sx, y: a.vy + e.clientY - a.sy })); return; }
    const p = toBoard(e.clientX, e.clientY);
    if (a.type === 'draw' && draft) {
      if (draft.kind === 'stroke') {
        const pts = draft.points;
        if (Math.hypot(p.x - pts[pts.length - 2], p.y - pts[pts.length - 1]) < 3 / view.s || pts.length >= 2400) return;
        setDraft({ ...draft, points: [...pts, Math.round(p.x), Math.round(p.y)] });
      }
      if (draft.kind === 'arrow') setDraft({ ...draft, x2: p.x, y2: p.y });
      if (draft.kind === 'frame') setDraft({ ...draft, x: Math.min(a.sx, p.x), y: Math.min(a.sy, p.y), w: Math.max(100, Math.abs(p.x - a.sx)), h: Math.max(100, Math.abs(p.y - a.sy)) });
      return;
    }
    if (a.type === 'move' && a.id) update(a.id, { x: (a.ox ?? 0) + (e.clientX - a.sx) / view.s, y: (a.oy ?? 0) + (e.clientY - a.sy) / view.s } as Partial<BoardItem>);
    if (a.type === 'resize' && a.id) {
      const it = items?.find((i) => i.id === a.id);
      const d = (e.clientX - a.sx) / view.s;
      const v = Math.max(40, (a.ow ?? 100) + d);
      if (it?.kind === 'sticker' || it?.kind === 'song') update(a.id, { size: Math.min(800, v) } as Partial<BoardItem>);
      else if (it?.kind === 'frame') update(a.id, { w: v, h: Math.max(100, (a.oy ?? 100) + (e.clientY - a.sy) / view.s) } as Partial<BoardItem>);
      else update(a.id, { w: Math.min(2000, Math.max(80, v)) } as Partial<BoardItem>);
    }
  }

  function onUp() {
    const a = action.current;
    action.current = null;
    if (a?.type === 'draw' && draft) {
      const ok = draft.kind === 'stroke' ? draft.points.length >= 4 : draft.kind === 'arrow' ? Math.hypot(draft.x2 - draft.x, draft.y2 - draft.y) > 20 : true;
      if (ok) commit([...(items ?? []), draft.kind === 'frame' ? draft : draft]);
      setDraft(null);
      if (draft.kind !== 'stroke') setTool('select');
      return;
    }
    if (a?.type === 'move' || a?.type === 'resize') setHistory((h) => [...h.slice(-40), items ?? []]);
  }

  function startMove(e: React.PointerEvent, it: BoardItem) {
    if (!mine || tool !== 'select' || e.button !== 0) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelected(it.id); setStickers(false);
    action.current = { type: 'move', sx: e.clientX, sy: e.clientY, vx: 0, vy: 0, id: it.id, ox: it.x, oy: it.y };
  }
  function startResize(e: React.PointerEvent, it: BoardItem) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const s = size(it);
    action.current = { type: 'resize', sx: e.clientX, sy: e.clientY, vx: 0, vy: 0, id: it.id, ow: it.kind === 'sticker' || it.kind === 'song' ? it.size : s.w, oy: s.h };
  }

  async function addPhotos(files: FileList | File[] | null, at?: { x: number; y: number }) {
    if (!files || !mine) return;
    const c = at ?? center();
    let i = 0;
    for (const f of Array.from(files).slice(0, 10)) {
      if (!f.type.startsWith('image/') && !/\.(heic|heif)$/i.test(f.name)) continue;
      try {
        const p = await processPhoto(f, 0);
        const up = await api.boardUpload(diaryId);
        await api.uploadFile({ kind: 'photo', path: up.path, token: up.token, signedUrl: up.signedUrl } as SignedUpload, p.full);
        if (up.readUrl) setUrls((u) => ({ ...u, [up.path]: up.readUrl! }));
        const ratio = p.features.height / p.features.width;
        const it: BoardItem = { id: uid(), kind: 'photo', path: up.path, x: c.x - 140 + i * 40, y: c.y - 140 * ratio + i * 30, rot: tilt(), w: 280, ratio };
        setItems((list) => [...(list ?? []), it]);
        i++;
      } catch { /* одно фото не загрузилось — остальные продолжаем */ }
    }
  }

  async function addSong() {
    const url = window.prompt('Ссылка на песню (Spotify, YouTube, Deezer, Яндекс Музыка…)');
    if (!url) return;
    const c = center();
    try {
      const r = await api.resolveSong(url.trim());
      const s = r.song.kind === 'link' ? r.song : null;
      add({ id: uid(), kind: 'song', x: c.x - 90, y: c.y - 90, rot: 0, url: url.trim(), title: [s?.artist, s?.title].filter(Boolean).join(' — ') || 'песня', cover: s?.coverUrl, preview: s?.previewUrl, size: 180 });
    } catch {
      add({ id: uid(), kind: 'song', x: c.x - 90, y: c.y - 90, rot: 0, url: url.trim(), title: 'песня', size: 180 });
    }
  }

  function playSong(it: Extract<BoardItem, { kind: 'song' }>) {
    if (!it.preview) { window.open(it.url, '_blank', 'noopener'); return; }
    if (playing === it.id) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause();
    audio.current = new Audio(it.preview);
    void audio.current.play();
    audio.current.onended = () => setPlaying(null);
    setPlaying(it.id);
  }
  useEffect(() => () => audio.current?.pause(), []);

  const list = useMemo(() => [...(items ?? [])].sort((a, b) => (a.kind === 'frame' ? -1 : 0) - (b.kind === 'frame' ? -1 : 0)), [items]);
  const empty = items !== null && items.length === 0;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#f1ebe0] text-[#2b241c] [--background:#f6f1e8] [--foreground:#2b241c] [--muted:#7a7064]">
      {/* Шапка */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-3 px-4 py-3">
        <Link href="/" className="pointer-events-auto rounded-full bg-background/80 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-muted shadow-sm backdrop-blur hover:text-foreground">← стол</Link>
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur">
          <span className="h-3 w-3 rounded-sm" style={{ background: cover }} />
          <h1 className="max-w-[40vw] truncate text-lg font-semibold">{title}</h1>
          {mine && <span className="font-mono text-[10px] text-muted">{saving === 'saving' ? 'сохраняю…' : saving === 'saved' ? 'сохранено ✓' : saving === 'error' ? 'не сохранилось' : ''}</span>}
        </div>
        <div className="pointer-events-auto ml-auto flex items-center gap-2">
          <button type="button" onClick={() => fit(items ?? [], false)} className="rounded-full bg-background/80 px-3 py-2 font-mono text-[11px] uppercase tracking-wider shadow-sm backdrop-blur hover:bg-background" title="Показать всё">⤢ всё</button>
          <Link href={`/diary/${diaryId}/book`} className="rounded-full bg-background/80 px-3 py-2 font-mono text-[11px] uppercase tracking-wider shadow-sm backdrop-blur hover:bg-background">📖 книга</Link>
          <Link href={`/diary/${diaryId}`} className="rounded-full bg-background/80 px-3 py-2 font-mono text-[11px] uppercase tracking-wider shadow-sm backdrop-blur hover:bg-background">архив</Link>
        </div>
      </header>

      {/* Пространство */}
      <div ref={wrap} className={`relative flex-1 touch-none ${tool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
        style={{ backgroundImage: `radial-gradient(circle, rgba(43,36,28,${0.16}) ${Math.max(0.6, view.s)}px, transparent ${Math.max(0.6, view.s) + 0.4}px)`, backgroundSize: `${28 * view.s}px ${28 * view.s}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
        onPointerDown={onBgDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onDoubleClick={(e) => { if (!mine || e.target !== e.currentTarget) return; const p = toBoard(e.clientX, e.clientY); const it: BoardItem = { id: uid(), kind: 'note', x: p.x - 110, y: p.y - 30, rot: tilt(), text: '', w: 240, color, font: 'hand' }; add(it); setEditing(it.id); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void addPhotos(e.dataTransfer.files, toBoard(e.clientX, e.clientY)); }}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, transition: anim ? 'transform 1.2s cubic-bezier(0.2,0.8,0.2,1)' : undefined }}>

          {[...list, ...(draft?.kind === 'frame' ? [draft] : [])].map((it, idx) => {
            if (it.kind === 'stroke' || it.kind === 'arrow') return null;
            const s = size(it);
            const sel = selected === it.id;
            const common = {
              className: `absolute ${sel ? 'outline outline-2 outline-offset-4 outline-[#c8892b]' : ''}`,
              style: { left: it.x, top: it.y, width: s.w, height: it.kind === 'note' ? undefined : s.h, rotate: `${it.rot}deg`, animation: opened ? `pop-in 0.6s ease-out ${0.5 + Math.min(idx, 20) * 0.05}s both` : undefined } as React.CSSProperties,
              onPointerDown: (e: React.PointerEvent) => startMove(e, it),
            };
            const handle = sel && mine && (
              <span onPointerDown={(e) => startResize(e, it)} className="absolute -bottom-3 -right-3 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-[#c8892b] bg-white" aria-hidden />
            );
            if (it.kind === 'frame') return (
              <div key={it.id} {...common} className={`${common.className} rounded-lg border-2 border-dashed`} style={{ ...common.style, borderColor: `${it.color}55`, background: `${it.color}0d` }}>
                <input value={it.title} readOnly={!mine} onChange={(e) => update(it.id, { title: e.target.value })} onPointerDown={(e) => e.stopPropagation()}
                  className="absolute -top-9 left-0 bg-transparent font-mono text-sm uppercase tracking-[0.2em] outline-none" style={{ color: it.color }} />
                {handle}
              </div>
            );
            if (it.kind === 'note') return (
              <div key={it.id} {...common} className={`${common.className} rounded-sm px-4 py-3 shadow-md`}
                style={{ ...common.style, background: it.color === '#2b241c' ? '#fbf8f1' : `color-mix(in srgb, ${it.color} 22%, #fbf8f1)`, color: it.color === '#f4efe6' ? '#2b241c' : '#2b241c', minHeight: 70 }}
                onDoubleClick={(e) => { e.stopPropagation(); if (mine) setEditing(it.id); }}>
                <span className="absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2 rotate-[-3deg] bg-[#e8d9a8]/80" aria-hidden />
                {editing === it.id
                  ? <textarea autoFocus value={it.text} onChange={(e) => update(it.id, { text: e.target.value })} onBlur={() => { setEditing(null); if (!it.text.trim()) remove(it.id); }}
                      onPointerDown={(e) => e.stopPropagation()} rows={Math.max(2, it.text.split('\n').length)} placeholder="мысль, инсайт, воспоминание…"
                      className="w-full resize-none bg-transparent font-hand text-2xl leading-snug outline-none placeholder:opacity-40" />
                  : <p className="whitespace-pre-wrap font-hand text-2xl leading-snug">{it.text || ' '}</p>}
                {handle}
              </div>
            );
            if (it.kind === 'photo') return (
              <figure key={it.id} {...common} className={`${common.className} bg-[#fbf8f1] p-2 pb-8 shadow-lg`} style={{ ...common.style, height: undefined }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {urls[it.path] ? <img src={urls[it.path]} alt={it.caption ?? 'Фото'} draggable={false} className="w-full object-cover" style={{ aspectRatio: `1 / ${it.ratio}` }} />
                  : <div className="w-full animate-pulse bg-black/10" style={{ aspectRatio: `1 / ${it.ratio}` }} />}
                {handle}
              </figure>
            );
            if (it.kind === 'sticker') return (
              <div key={it.id} {...common}><StickerIcon shape={it.shape} color={it.color} paper="#fbf8f1" size={it.size} />{handle}</div>
            );
            if (it.kind === 'song') return (
              <div key={it.id} {...common} className={`${common.className} group/song`}>
                <button type="button" onClick={() => playSong(it)} onPointerDown={(e) => { if (tool !== 'select') e.stopPropagation(); }}
                  title={it.preview ? 'Нажмите — заиграет' : 'Открыть песню'}
                  className="relative block h-full w-full rounded-full shadow-xl"
                  style={{ background: 'repeating-radial-gradient(circle, #151515 0 2px, #262626 2px 4px)', animation: playing === it.id ? 'vinyl-spin 2.4s linear infinite' : undefined }}>
                  <span className="absolute inset-[30%] overflow-hidden rounded-full bg-[#c8892b]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {it.cover && <img src={`/api/music/cover?url=${encodeURIComponent(it.cover)}`} alt="" className="h-full w-full object-cover" draggable={false} />}
                  </span>
                </button>
                <p className="mt-2 text-center font-hand text-xl leading-tight">♪ {it.title}</p>
                {handle}
              </div>
            );
            // Карточка дня — собирает наша система.
            const d = days.get(it.dayId);
            const img = d?.posterUrl ?? d?.photos[0]?.thumbUrl;
            return (
              <div key={it.id} {...common} className={`${common.className} group/day`}>
                <div className="relative overflow-hidden rounded-sm shadow-2xl ring-1 ring-black/10" style={{ aspectRatio: '9 / 16', background: d?.style?.palette.bg ?? '#e9e2d6' }}>
                  {d?.sealed ? <div className="flex h-full items-center justify-center bg-[#e8dcc4] font-hand text-2xl text-[#4a3a28]">✉ капсула</div>
                    // eslint-disable-next-line @next/next/no-img-element
                    : img ? <img src={img} alt={d?.title ?? ''} draggable={false} className="h-full w-full object-cover" /> : null}
                  <Link href={`/day/${it.dayId}`} onPointerDown={(e) => e.stopPropagation()}
                    className="absolute inset-x-2 bottom-2 rounded-full bg-black/55 px-3 py-1.5 text-center font-mono text-[10px] uppercase tracking-wider text-white opacity-0 backdrop-blur transition group-hover/day:opacity-100">открыть день →</Link>
                </div>
                <p className="mt-2 text-lg leading-tight">{d?.title ?? '…'}</p>
                <p className="font-mono text-[10px] opacity-60">{d?.date.split('-').reverse().join('.')}</p>
                {handle}
              </div>
            );
          })}
          {/* Рисунки и стрелки — поверх карточек, как маркером по столу */}
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1">
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <marker id="head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="context-stroke" /></marker>
            </defs>
            {[...list, ...(draft && draft.kind !== 'frame' ? [draft] : [])].map((it) => it.kind === 'stroke'
              ? <path key={it.id} d={strokePath(it.points)} fill="none" stroke={it.color} strokeWidth={it.width} strokeLinecap="round" strokeLinejoin="round" filter={it.glow ? 'url(#glow)' : undefined}
                  className={`pointer-events-auto ${selected === it.id ? 'opacity-70' : ''}`} onPointerDown={(e) => { if (mine && tool === 'select') { e.stopPropagation(); setSelected(it.id); } }} />
              : it.kind === 'arrow'
                ? <path key={it.id} d={`M${it.x} ${it.y} Q${(it.x + it.x2) / 2 + (it.y2 - it.y) * 0.15} ${(it.y + it.y2) / 2 - (it.x2 - it.x) * 0.15} ${it.x2} ${it.y2}`} fill="none" stroke={it.color} strokeWidth={it.width} strokeLinecap="round" markerEnd="url(#head)"
                    className={`pointer-events-auto ${selected === it.id ? 'opacity-70' : ''}`} onPointerDown={(e) => { if (mine && tool === 'select') { e.stopPropagation(); setSelected(it.id); } }} />
                : null)}
          </svg>
        </div>

        {empty && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6 text-center" style={{ animation: 'pop-in 0.8s ease-out 0.3s both' }}>
            <p className="font-hand text-4xl opacity-70">Это ваше свободное пространство</p>
            <div className="flex flex-wrap justify-center gap-4 font-mono text-[11px] uppercase tracking-wider opacity-60">
              <span className="rounded-md border-2 border-dashed border-current px-5 py-6">двойной щелчок —<br />заметка</span>
              <span className="rounded-md border-2 border-dashed border-current px-5 py-6">перетащите сюда<br />фото</span>
              <span className="rounded-md border-2 border-dashed border-current px-5 py-6">«+ день» — система<br />соберёт воспоминание</span>
            </div>
          </div>
        )}
      </div>

      {/* Панель инструментов */}
      {mine && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2" style={{ animation: 'pop-in 0.6s ease-out 0.6s both' }}>
          {stickers && (
            <div className="pointer-events-auto grid grid-cols-8 gap-1 rounded-2xl bg-background/95 p-2 shadow-2xl backdrop-blur">
              {STICKER_SHAPES.map((s: StickerShape) => (
                <button key={s} type="button" title={SHAPE_NAMES[s]} className="grid h-11 w-11 place-items-center rounded-lg transition hover:scale-110 hover:bg-foreground/10"
                  onClick={() => { const c = center(); add({ id: uid(), kind: 'sticker', shape: s, x: c.x - 60, y: c.y - 60, rot: tilt() * 3, size: 120, color: color === '#2b241c' ? '#c8892b' : color }); setStickers(false); }}>
                  <StickerIcon shape={s} color={color === '#2b241c' ? '#c8892b' : color} paper="#fbf8f1" />
                </button>
              ))}
            </div>
          )}
          {(tool === 'pen' || tool === 'note' || tool === 'arrow') && (
            <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-2 shadow-xl backdrop-blur">
              {COLORS.map((c) => <button key={c} type="button" aria-label={`Цвет ${c}`} onClick={() => setColor(c)} className={`h-6 w-6 rounded-full ring-1 ring-black/15 ${color === c ? 'scale-110 outline outline-2 outline-offset-2 outline-current' : ''}`} style={{ background: c }} />)}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Свой цвет" className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0" />
              {tool === 'pen' && <>
                <span className="mx-1 h-5 w-px bg-foreground/15" />
                {[2, 4, 10, 24].map((w) => <button key={w} type="button" onClick={() => setWidth(w)} aria-label={`Толщина ${w}`} className={`grid h-7 w-7 place-items-center rounded-full ${width === w ? 'bg-foreground/15' : ''}`}><span className="rounded-full bg-current" style={{ width: Math.min(18, w + 2), height: Math.min(18, w + 2) }} /></button>)}
                <button type="button" onClick={() => setGlow((g) => !g)} className={`rounded-full px-2.5 py-1 font-mono text-[11px] ${glow ? 'bg-foreground text-background' : ''}`}>✦ сияние</button>
              </>}
            </div>
          )}
          <nav className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-background/95 px-2 py-1.5 shadow-2xl ring-1 ring-black/5 backdrop-blur" aria-label="Инструменты доски">
            {([['select', '✥', 'Двигать (V)'], ['note', '✎', 'Заметка (N)'], ['pen', '〰', 'Кисть (P)'], ['arrow', '→', 'Стрелка (A)'], ['frame', '▢', 'Рамка-страница (F)']] as const).map(([t, icon, tip]) => (
              <button key={t} type="button" onClick={() => { setTool(t); setStickers(false); }} aria-pressed={tool === t} className={`${iconBtn} ${tool === t ? 'bg-foreground text-background hover:bg-foreground' : ''}`}>{icon}<Tip>{tip}</Tip></button>
            ))}
            <span className="mx-1 h-6 w-px bg-foreground/15" />
            <button type="button" onClick={() => fileRef.current?.click()} className={iconBtn}>▣<Tip>Фото</Tip></button>
            <button type="button" onClick={() => setStickers((v) => !v)} aria-pressed={stickers} className={iconBtn}>✦<Tip>Стикер</Tip></button>
            <button type="button" onClick={addSong} className={iconBtn}>◉<Tip>Песня</Tip></button>
            <span className="mx-1 h-6 w-px bg-foreground/15" />
            <Link href={`/diary/${diaryId}/new`} data-magnetic className="ml-1 rounded-full bg-foreground px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-background">＋ день</Link>
            <span className="mx-1 h-6 w-px bg-foreground/15" />
            <button type="button" onClick={undo} disabled={!history.length} className={iconBtn}>↶<Tip>Отменить (⌘Z)</Tip></button>
            {selected && <button type="button" onClick={() => remove(selected)} className={`${iconBtn} text-red-700`}>✕<Tip>Удалить (Delete)</Tip></button>}
          </nav>
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
        </div>
      )}
      {!mine && items !== null && (
        <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-4 py-2 font-mono text-[11px] text-muted shadow">только просмотр · колесо — приблизить, перетаскивание — двигать</p>
      )}
      {items === null && <p className="absolute inset-0 grid place-items-center font-mono text-xs text-muted">раскладываю доску…</p>}
    </div>
  );
}

/** Прямоугольник элемента в координатах доски (у рисунка и стрелки — по их точкам). */
function bounds(it: BoardItem): { x: number; y: number; w: number; h: number } {
  if (it.kind === 'stroke') {
    const xs = it.points.filter((_, i) => i % 2 === 0), ys = it.points.filter((_, i) => i % 2 === 1);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  if (it.kind === 'arrow') return { x: Math.min(it.x, it.x2), y: Math.min(it.y, it.y2), w: Math.abs(it.x2 - it.x), h: Math.abs(it.y2 - it.y) };
  return { x: it.x, y: it.y, ...size(it) };
}

/** Размер элемента на доске (для рамки выделения, «показать всё»). */
function size(it: BoardItem): { w: number; h: number } {
  switch (it.kind) {
    case 'note': return { w: it.w, h: 90 };
    case 'photo': return { w: it.w, h: it.w * it.ratio + 40 };
    case 'sticker': return { w: it.size, h: it.size };
    case 'song': return { w: it.size, h: it.size + 40 };
    case 'day': return { w: it.w, h: (it.w * 16) / 9 + 50 };
    case 'frame': return { w: it.w, h: it.h };
    case 'arrow': return { w: Math.abs(it.x2 - it.x), h: Math.abs(it.y2 - it.y) };
    case 'stroke': {
      const xs = it.points.filter((_, i) => i % 2 === 0), ys = it.points.filter((_, i) => i % 2 === 1);
      return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
  }
}
