'use client';
// Ядро свободной доски (план 21.11, человек 2): бесконечное пространство, как в Miro, но в духе дневника.
// Одно и то же ядро у доски дневника и у доски дня; снаружи приходят load/save/upload, шапка и кнопки.
// Двигать — перетаскивать фон, приближать — колесо или щипок двумя пальцами. Двойной щелчок — заметка.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type SignedUpload } from '@/lib/client/api';
import { processPhoto, type ProcessedPhoto } from '@/lib/client/imageProcess';
import { STICKER_SHAPES, type StickerShape } from '@/lib/decor/decor';
import { SHAPE_NAMES } from '@/lib/decor/shapes';
import type { Board, BoardItem } from '@/lib/board/board';
import { StickerIcon } from '../decor/StickerIcon';
import { cleanTranscript } from '@/lib/ai/cleanTranscript';
import { toBase64, VoiceBubble, voiceFromFile, VoiceMic, type Recording } from './VoiceNote';

export type Tool = 'select' | 'note' | 'pen' | 'arrow' | 'frame';
interface View { x: number; y: number; s: number }

/** Подписанная загрузка фото или голосового (ext) на доску (у доски дневника и у доски дня — свои роуты). */
export interface BoardUpload { path: string; token: string; signedUrl: string; readUrl: string | null }

/** Ручка управления доской снаружи: положить элемент (заметку из голоса, настроение…), узнать центр экрана. */
export interface BoardControls {
  add: (it: BoardItem, opts?: { select?: boolean }) => void;
  center: () => { x: number; y: number };
  items: () => BoardItem[];
  update: (id: string, patch: Partial<BoardItem>) => void;
}

/** Как нарисовать элемент, который ядро не знает само (карточка дня, настроение…). */
export type RenderItem = (it: BoardItem, ctx: { selected: boolean; editable: boolean }) => React.ReactNode;

export const COLORS = ['#2b241c', '#f4efe6', '#c8892b', '#b5653a', '#7a3b2e', '#2f6f73', '#3d4b6b', '#7a4a6a', '#8a9a5b', '#e0b84d'];
export const uid = () => Math.random().toString(36).slice(2, 10);
export const tilt = () => Math.round(Math.random() * 6 - 3);
export const iconBtn = 'group relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg transition hover:bg-foreground/10 disabled:opacity-30';

export function Tip({ children }: { children: string }) {
  return <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 font-mono text-[10px] text-background opacity-0 transition group-hover:opacity-100">{children}</span>;
}

function strokePath(p: number[]) {
  if (p.length < 4) return `M${p[0]} ${p[1]} l0.1 0`;
  let d = `M${p[0]} ${p[1]}`;
  for (let i = 2; i < p.length - 2; i += 2) d += ` Q${p[i]} ${p[i + 1]} ${(p[i] + p[i + 2]) / 2} ${(p[i + 1] + p[i + 3]) / 2}`;
  return `${d} L${p[p.length - 2]} ${p[p.length - 1]}`;
}

export interface BoardCanvasProps {
  /** Загрузить доску: элементы и подписанные ссылки на фото. */
  load: () => Promise<{ items: BoardItem[]; urls: Record<string, string> }>;
  save: (board: Board) => Promise<unknown>;
  /** ext — расширение голосового (webm, ogg, m4a…); без него — фото. */
  upload: (ext?: string) => Promise<BoardUpload>;
  editable: boolean;
  /** Пришли из книги: камера продолжает наезд и элементы «влетают». */
  opened?: boolean;
  /** Шапка слева (назад, название, дата…) и справа (кнопки). Статус сохранения ядро добавит само. */
  header?: React.ReactNode;
  headerRight?: React.ReactNode;
  /** Кнопки в панели инструментов после песни (например, «＋ день» или «настроение»). */
  tools?: React.ReactNode;
  /** Главная кнопка справа на панели («＋ день», «Собрать день»). */
  primary?: React.ReactNode;
  /** Что показать на пустой доске. */
  empty?: React.ReactNode;
  renderItem?: RenderItem;
  /** Размер элементов, которые рисует renderItem (для выделения и «показать всё»). */
  sizeOf?: (it: BoardItem) => { w: number; h: number } | undefined;
  controls?: React.RefObject<BoardControls | null>;
  onItemsChange?: (items: BoardItem[]) => void;
  /** Клик по элементу в режиме «двигать» без перетаскивания (открыть выбор чувств у капли и т. п.). */
  onItemClick?: (it: BoardItem) => void;
  /** Фото легло на доску: обёртка может взять из него дату или место съёмки. */
  onPhoto?: (p: ProcessedPhoto) => void;
}

export function BoardCanvas({ load, save, upload, editable, opened = false, header, headerRight, tools, primary, empty: emptyHint, renderItem, sizeOf, controls, onItemsChange, onItemClick, onPhoto }: BoardCanvasProps) {
  const [items, setItems] = useState<BoardItem[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
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
  const action = useRef<{ type: 'pan' | 'move' | 'resize' | 'draw' | 'pinch'; sx: number; sy: number; vx: number; vy: number; id?: string; ox?: number; oy?: number; ow?: number; moved?: boolean; d0?: number; s0?: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState<Set<string>>(new Set());
  const loaded = useRef(false);
  const sizeRef = useRef(sizeOf);
  useEffect(() => { sizeRef.current = sizeOf; });
  const measure = useCallback((it: BoardItem) => sizeRef.current?.(it) ?? size(it), []);

  useEffect(() => {
    let alive = true;
    load().then((b) => {
      if (!alive) return;
      setUrls(b.urls);
      setItems(b.items);
      fit(b.items, opened);
    }).catch(() => alive && setItems([]));
    return () => { alive = false; };
    // Доска загружается один раз на монтирование: load снаружи пересоздаётся на каждый рендер.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Камера «влетает» в доску и показывает всё, что на ней лежит.
  function fit(list: BoardItem[], fly: boolean) {
    const el = wrap.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    if (!list.length) {
      const target = { x: W / 2, y: H / 2, s: 1 };
      if (fly) { setView({ ...target, s: 0.6 }); requestAnimationFrame(() => { setAnim(true); setView(target); setTimeout(() => setAnim(false), 1300); }); }
      else setView(target);
      return;
    }
    const bs = list.map((it) => bounds(it, measure));
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
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });
  useEffect(() => {
    if (!items) return;
    onItemsChange?.(items);
    if (!editable) return;
    if (!loaded.current) { loaded.current = true; return; }
    setSaving('saving');
    const t = setTimeout(() => {
      saveRef.current({ v: 1, items }).then(() => setSaving('saved'), () => setSaving('error'));
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, editable]);

  const commit = useCallback((next: BoardItem[]) => {
    setHistory((h) => [...h.slice(-40), items ?? []]);
    setItems(next);
  }, [items]);
  const update = useCallback((id: string, patch: Partial<BoardItem>) => setItems((list) => list?.map((i) => (i.id === id ? ({ ...i, ...patch } as BoardItem) : i)) ?? list), []);
  const remove = (id: string) => { commit((items ?? []).filter((i) => i.id !== id)); setSelected(null); };
  const undo = () => { const prev = history[history.length - 1]; if (!prev) return; setHistory((h) => h.slice(0, -1)); setItems(prev); };

  const toBoard = (cx: number, cy: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: (cx - r.left - view.x) / view.s, y: (cy - r.top - view.y) / view.s };
  };
  const center = () => { const el = wrap.current!; return toBoard(el.getBoundingClientRect().left + el.clientWidth / 2, el.getBoundingClientRect().top + el.clientHeight / 2); };
  const add = (it: BoardItem) => { commit([...(items ?? []), it]); setSelected(it.id); setTool('select'); };

  // Ручка для обёрток: голосовая заметка, капля настроения и т. п. кладутся тем же путём, что и руками.
  const addRef = useRef(add); const centerRef = useRef(center); const itemsRef = useRef(items);
  useEffect(() => { addRef.current = add; centerRef.current = center; itemsRef.current = items; });
  useEffect(() => {
    if (!controls) return;
    controls.current = {
      add: (it, opts) => { addRef.current(it); if (opts?.select === false) setSelected(null); },
      center: () => centerRef.current(),
      items: () => itemsRef.current ?? [],
      update,
    };
    return () => { controls.current = null; };
  }, [controls, update]);

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
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && editable) { e.preventDefault(); remove(selected); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && editable) { e.preventDefault(); undo(); }
      if (e.key === 'Escape') { setSelected(null); setEditing(null); setTool('select'); setStickers(false); }
      const keys: Record<string, Tool> = { v: 'select', n: 'note', p: 'pen', a: 'arrow', f: 'frame' };
      if (editable && !e.metaKey && !e.ctrlKey && keys[e.key.toLowerCase()]) setTool(keys[e.key.toLowerCase()]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Щипок двумя пальцами (телефон): вторая точка касания превращает любое действие в зум вокруг середины.
  function trackPointer(e: React.PointerEvent): boolean {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size !== 2) return false;
    const [a, b] = [...pointers.current.values()];
    setDraft(null);
    action.current = { type: 'pinch', sx: (a.x + b.x) / 2, sy: (a.y + b.y) / 2, vx: view.x, vy: view.y, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: view.s };
    return true;
  }

  function onBgDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (trackPointer(e)) return;
    setSelected(null); setEditing(null); setStickers(false);
    const p = toBoard(e.clientX, e.clientY);
    if (!editable || tool === 'select') { action.current = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; return; }
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
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const a = action.current;
    if (!a) return;
    if (a.type === 'pinch') {
      if (pointers.current.size < 2) return;
      const [p1, p2] = [...pointers.current.values()];
      const r = wrap.current!.getBoundingClientRect();
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      const s = Math.min(4, Math.max(0.1, (a.s0 ?? 1) * (Math.hypot(p1.x - p2.x, p1.y - p2.y) / (a.d0 ?? 1))));
      // Точка доски под серединой пальцев остаётся под ними, а сдвиг середины двигает доску.
      const bx = (a.sx - r.left - a.vx) / (a.s0 ?? 1), by = (a.sy - r.top - a.vy) / (a.s0 ?? 1);
      setView({ s, x: mx - r.left - bx * s, y: my - r.top - by * s });
      return;
    }
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
    if (a.type === 'move' && a.id) {
      if (Math.hypot(e.clientX - a.sx, e.clientY - a.sy) > 4) a.moved = true;
      update(a.id, { x: (a.ox ?? 0) + (e.clientX - a.sx) / view.s, y: (a.oy ?? 0) + (e.clientY - a.sy) / view.s } as Partial<BoardItem>);
    }
    if (a.type === 'resize' && a.id) {
      const it = items?.find((i) => i.id === a.id);
      const d = (e.clientX - a.sx) / view.s;
      const v = Math.max(40, (a.ow ?? 100) + d);
      if (it && 'size' in it) update(a.id, { size: Math.min(800, v) } as Partial<BoardItem>);
      else if (it?.kind === 'frame') update(a.id, { w: v, h: Math.max(100, (a.oy ?? 100) + (e.clientY - a.sy) / view.s) } as Partial<BoardItem>);
      else if (it?.kind === 'voice') update(a.id, { w: Math.min(900, Math.max(200, v)) } as Partial<BoardItem>);
      // Пределы ширины — как в схеме доски, иначе сохранение отклонится.
      else update(a.id, { w: Math.min(it?.kind === 'note' ? 1200 : 2000, Math.max(80, v)) } as Partial<BoardItem>);
    }
  }

  function onUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    const a = action.current;
    if (a?.type === 'pinch') { if (pointers.current.size === 0) action.current = null; return; }
    action.current = null;
    if (a?.type === 'draw' && draft) {
      const ok = draft.kind === 'stroke' ? draft.points.length >= 4 : draft.kind === 'arrow' ? Math.hypot(draft.x2 - draft.x, draft.y2 - draft.y) > 20 : true;
      if (ok) commit([...(items ?? []), draft]);
      setDraft(null);
      if (draft.kind !== 'stroke') setTool('select');
      return;
    }
    if (a?.type === 'move' && !a.moved && a.id) {
      const it = items?.find((i) => i.id === a.id);
      if (it) onItemClick?.(it);
      return;
    }
    if (a?.type === 'move' || a?.type === 'resize') setHistory((h) => [...h.slice(-40), items ?? []]);
  }

  function startMove(e: React.PointerEvent, it: BoardItem) {
    if (!editable || tool !== 'select' || e.button !== 0) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (trackPointer(e)) return;
    setSelected(it.id); setStickers(false);
    action.current = { type: 'move', sx: e.clientX, sy: e.clientY, vx: 0, vy: 0, id: it.id, ox: it.x, oy: it.y };
  }
  function startResize(e: React.PointerEvent, it: BoardItem) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const s = measure(it);
    action.current = { type: 'resize', sx: e.clientX, sy: e.clientY, vx: 0, vy: 0, id: it.id, ow: 'size' in it ? (it as { size: number }).size : s.w, oy: s.h };
  }

  async function addPhotos(files: FileList | File[] | null, at?: { x: number; y: number }) {
    if (!files || !editable) return;
    const c = at ?? center();
    let i = 0;
    for (const f of Array.from(files).slice(0, 10)) {
      if (!f.type.startsWith('image/') && !/\.(heic|heif)$/i.test(f.name)) continue;
      try {
        const p = await processPhoto(f, 0);
        const up = await upload();
        await api.uploadFile({ kind: 'photo', path: up.path, token: up.token, signedUrl: up.signedUrl } as SignedUpload, p.full);
        if (up.readUrl) setUrls((u) => ({ ...u, [up.path]: up.readUrl! }));
        onPhoto?.(p);
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

  // Голосовое (как в WhatsApp): файл → папка доски, пузырь → на доску, расшифровка догоняет в фоне.
  async function addVoice(r: Recording, at?: { x: number; y: number }) {
    if (!editable) return;
    const c = at ?? center();
    const up = await upload(r.ext);
    await api.uploadFile({ kind: 'voice', path: up.path, token: up.token, signedUrl: up.signedUrl } as SignedUpload, r.blob);
    setUrls((u) => ({ ...u, [up.path]: up.readUrl ?? URL.createObjectURL(r.blob) }));
    const it: BoardItem = { id: uid(), kind: 'voice', path: up.path, sec: Math.round(r.sec * 10) / 10, peaks: r.peaks, x: c.x - 170, y: c.y - 50, rot: tilt() / 2, w: 340,
      ...(r.said ? { transcript: cleanTranscript(r.said).slice(0, 4000) } : {}) };
    add(it);
    void transcribe(it.id, r);
  }

  async function transcribe(id: string, r: Recording) {
    setTranscribing((s) => new Set(s).add(id));
    try {
      const res = await api.story({ audio: await toBase64(r.blob), mime: r.blob.type || 'audio/webm', ...(r.said ? { transcript: r.said } : {}) });
      // Только дословная расшифровка: пересказ модели без слов (тишина, музыка) — выдумка, её не берём.
      const text = cleanTranscript(res.transcript).trim();
      if (text) update(id, { transcript: text.slice(0, 4000) } as Partial<BoardItem>);
    } catch { /* расшифровка не получилась — останется живая из браузера, её можно дописать руками */ }
    setTranscribing((s) => { const n = new Set(s); n.delete(id); return n; });
  }

  async function addVoiceFiles(files: File[], at: { x: number; y: number }) {
    for (const [i, f] of files.slice(0, 3).entries()) {
      try { await addVoice(await voiceFromFile(f), { x: at.x + i * 40, y: at.y + i * 140 }); }
      catch (e) { window.alert(e instanceof Error ? e.message : 'Не получилось добавить голосовое'); }
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
  const isEmpty = items !== null && items.length === 0;
  const pill = 'rounded-full bg-background/80 px-3 py-2 font-mono text-[11px] uppercase tracking-wider shadow-sm backdrop-blur hover:bg-background';

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#f1ebe0] text-[#2b241c] [--background:#f6f1e8] [--foreground:#2b241c] [--muted:#7a7064]">
      {/* Шапка */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
        <div className="pointer-events-auto flex min-w-0 items-center gap-2">{header}</div>
        {editable && <span className="pointer-events-auto font-mono text-[10px] text-muted">{saving === 'saving' ? 'сохраняю…' : saving === 'saved' ? 'сохранено ✓' : saving === 'error' ? 'не сохранилось' : ''}</span>}
        <div className="pointer-events-auto ml-auto flex items-center gap-2">
          <button type="button" onClick={() => fit(items ?? [], false)} className={pill} title="Показать всё">⤢ всё</button>
          {headerRight}
        </div>
      </header>

      {/* Пространство */}
      <div ref={wrap} className={`relative flex-1 touch-none ${tool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
        style={{ backgroundImage: `radial-gradient(circle, rgba(43,36,28,${0.16}) ${Math.max(0.6, view.s)}px, transparent ${Math.max(0.6, view.s) + 0.4}px)`, backgroundSize: `${28 * view.s}px ${28 * view.s}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
        onPointerDown={onBgDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onDoubleClick={(e) => { if (!editable || e.target !== e.currentTarget) return; const p = toBoard(e.clientX, e.clientY); const it: BoardItem = { id: uid(), kind: 'note', x: p.x - 110, y: p.y - 30, rot: tilt(), text: '', w: 240, color, font: 'hand' }; add(it); setEditing(it.id); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const at = toBoard(e.clientX, e.clientY), files = Array.from(e.dataTransfer.files);
          const isAudio = (f: File) => f.type.startsWith('audio/') || /\.(m4a|mp3|ogg|oga|opus|wav|webm|aac)$/i.test(f.name);
          void addPhotos(files.filter((f) => !isAudio(f)), at);
          if (editable) void addVoiceFiles(files.filter(isAudio), at);
        }}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, transition: anim ? 'transform 1.2s cubic-bezier(0.2,0.8,0.2,1)' : undefined }}>

          {[...list, ...(draft?.kind === 'frame' ? [draft] : [])].map((it, idx) => {
            if (it.kind === 'stroke' || it.kind === 'arrow') return null;
            const s = measure(it);
            const sel = selected === it.id;
            const common = {
              className: `absolute ${sel ? 'outline outline-2 outline-offset-4 outline-[#c8892b]' : ''}`,
              style: { left: it.x, top: it.y, width: s.w, height: it.kind === 'note' || it.kind === 'voice' ? undefined : s.h, rotate: `${it.rot}deg`, animation: opened ? `pop-in 0.6s ease-out ${0.5 + Math.min(idx, 20) * 0.05}s both` : undefined } as React.CSSProperties,
              onPointerDown: (e: React.PointerEvent) => startMove(e, it),
            };
            const handle = sel && editable && (
              <span onPointerDown={(e) => startResize(e, it)} className="absolute -bottom-3 -right-3 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-[#c8892b] bg-white" aria-hidden />
            );
            if (it.kind === 'frame') return (
              <div key={it.id} {...common} className={`${common.className} rounded-lg border-2 border-dashed`} style={{ ...common.style, borderColor: `${it.color}55`, background: `${it.color}0d` }}>
                <input value={it.title} readOnly={!editable} onChange={(e) => update(it.id, { title: e.target.value })} onPointerDown={(e) => e.stopPropagation()}
                  className="absolute -top-9 left-0 bg-transparent font-mono text-sm uppercase tracking-[0.2em] outline-none" style={{ color: it.color }} />
                {handle}
              </div>
            );
            if (it.kind === 'note') return (
              <div key={it.id} {...common} className={`${common.className} rounded-sm px-4 py-3 shadow-md`}
                style={{ ...common.style, background: it.color === '#2b241c' ? '#fbf8f1' : `color-mix(in srgb, ${it.color} 22%, #fbf8f1)`, color: '#2b241c', minHeight: 70 }}
                onDoubleClick={(e) => { e.stopPropagation(); if (editable) setEditing(it.id); }}>
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
            if (it.kind === 'voice') return (
              <div key={it.id} {...common}>
                <VoiceBubble item={it} url={urls[it.path]} transcribing={transcribing.has(it.id)} editable={editable}
                  onTranscript={(text) => commit((items ?? []).map((i) => (i.id === it.id ? { ...i, transcript: text || undefined } as BoardItem : i)))} />
                {handle}
              </div>
            );
            // Остальное (карточка дня, настроение…) рисует обёртка.
            return (
              <div key={it.id} {...common}>
                {renderItem?.(it, { selected: sel, editable })}
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
                  className={`pointer-events-auto ${selected === it.id ? 'opacity-70' : ''}`} onPointerDown={(e) => { if (editable && tool === 'select') { e.stopPropagation(); setSelected(it.id); } }} />
              : it.kind === 'arrow'
                ? <path key={it.id} d={`M${it.x} ${it.y} Q${(it.x + it.x2) / 2 + (it.y2 - it.y) * 0.15} ${(it.y + it.y2) / 2 - (it.x2 - it.x) * 0.15} ${it.x2} ${it.y2}`} fill="none" stroke={it.color} strokeWidth={it.width} strokeLinecap="round" markerEnd="url(#head)"
                    className={`pointer-events-auto ${selected === it.id ? 'opacity-70' : ''}`} onPointerDown={(e) => { if (editable && tool === 'select') { e.stopPropagation(); setSelected(it.id); } }} />
                : null)}
          </svg>
        </div>

        {isEmpty && emptyHint}
      </div>

      {/* Панель инструментов */}
      {editable && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex flex-col items-center gap-2 px-2 sm:bottom-4" style={{ animation: 'pop-in 0.6s ease-out 0.6s both' }}>
          {stickers && (
            <div className="pointer-events-auto grid max-w-[96vw] grid-cols-6 gap-1 rounded-2xl bg-background/95 p-2 shadow-2xl backdrop-blur sm:grid-cols-8">
              {STICKER_SHAPES.map((s: StickerShape) => (
                <button key={s} type="button" title={SHAPE_NAMES[s]} className="grid h-11 w-11 place-items-center rounded-lg transition hover:scale-110 hover:bg-foreground/10"
                  onClick={() => { const c = center(); add({ id: uid(), kind: 'sticker', shape: s, x: c.x - 60, y: c.y - 60, rot: tilt() * 3, size: 120, color: color === '#2b241c' ? '#c8892b' : color }); setStickers(false); }}>
                  <StickerIcon shape={s} color={color === '#2b241c' ? '#c8892b' : color} paper="#fbf8f1" />
                </button>
              ))}
            </div>
          )}
          {(tool === 'pen' || tool === 'note' || tool === 'arrow') && (
            <div className="pointer-events-auto flex max-w-[96vw] items-center gap-1.5 overflow-x-auto [scrollbar-width:none] rounded-full bg-background/95 px-3 py-2 shadow-xl backdrop-blur">
              {COLORS.map((c) => <button key={c} type="button" aria-label={`Цвет ${c}`} onClick={() => setColor(c)} className={`h-7 w-7 shrink-0 rounded-full ring-1 ring-black/15 ${color === c ? 'scale-110 outline outline-2 outline-offset-2 outline-current' : ''}`} style={{ background: c }} />)}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Свой цвет" className="h-7 w-7 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0" />
              {tool === 'pen' && <>
                <span className="mx-1 h-5 w-px shrink-0 bg-foreground/15" />
                {[2, 4, 10, 24].map((w) => <button key={w} type="button" onClick={() => setWidth(w)} aria-label={`Толщина ${w}`} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${width === w ? 'bg-foreground/15' : ''}`}><span className="rounded-full bg-current" style={{ width: Math.min(18, w + 2), height: Math.min(18, w + 2) }} /></button>)}
                <button type="button" onClick={() => setGlow((g) => !g)} className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] ${glow ? 'bg-foreground text-background' : ''}`}>✦ сияние</button>
              </>}
            </div>
          )}
          <nav className="pointer-events-auto flex max-w-[98vw] items-center gap-0.5 overflow-x-auto [scrollbar-width:none] rounded-full bg-background/95 px-2 py-1.5 shadow-2xl ring-1 ring-black/5 backdrop-blur" aria-label="Инструменты доски">
            {([['select', '✥', 'Двигать (V)'], ['note', '✎', 'Заметка (N)'], ['pen', '〰', 'Кисть (P)'], ['arrow', '→', 'Стрелка (A)'], ['frame', '▢', 'Рамка-страница (F)']] as const).map(([t, icon, tip]) => (
              <button key={t} type="button" onClick={() => { setTool(t); setStickers(false); }} aria-pressed={tool === t} className={`${iconBtn} ${tool === t ? 'bg-foreground text-background hover:bg-foreground' : ''}`}>{icon}<Tip>{tip}</Tip></button>
            ))}
            <span className="mx-1 h-6 w-px shrink-0 bg-foreground/15" />
            <button type="button" onClick={() => fileRef.current?.click()} className={iconBtn}>▣<Tip>Фото</Tip></button>
            <button type="button" onClick={() => setStickers((v) => !v)} aria-pressed={stickers} className={iconBtn}>✦<Tip>Стикер</Tip></button>
            <button type="button" onClick={addSong} className={iconBtn}>◉<Tip>Песня</Tip></button>
            <VoiceMic onRecorded={(r) => addVoice(r)} className={iconBtn} />
            {tools}
            {primary && <><span className="mx-1 h-6 w-px shrink-0 bg-foreground/15" />{primary}</>}
            <span className="mx-1 h-6 w-px shrink-0 bg-foreground/15" />
            <button type="button" onClick={undo} disabled={!history.length} className={iconBtn}>↶<Tip>Отменить (⌘Z)</Tip></button>
            {selected && <button type="button" onClick={() => remove(selected)} className={`${iconBtn} text-red-700`}>✕<Tip>Удалить (Delete)</Tip></button>}
          </nav>
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
        </div>
      )}
      {!editable && items !== null && (
        <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-4 py-2 font-mono text-[11px] text-muted shadow">только просмотр · колесо — приблизить, перетаскивание — двигать</p>
      )}
      {items === null && <p className="absolute inset-0 grid place-items-center font-mono text-xs text-muted">раскладываю доску…</p>}
    </div>
  );
}

/** Прямоугольник элемента в координатах доски (у рисунка и стрелки — по их точкам). */
export function bounds(it: BoardItem, measure: (it: BoardItem) => { w: number; h: number } = size): { x: number; y: number; w: number; h: number } {
  if (it.kind === 'stroke') {
    const xs = it.points.filter((_, i) => i % 2 === 0), ys = it.points.filter((_, i) => i % 2 === 1);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  if (it.kind === 'arrow') return { x: Math.min(it.x, it.x2), y: Math.min(it.y, it.y2), w: Math.abs(it.x2 - it.x), h: Math.abs(it.y2 - it.y) };
  return { x: it.x, y: it.y, ...measure(it) };
}

/** Размер элемента на доске (для рамки выделения, «показать всё»). */
export function size(it: BoardItem): { w: number; h: number } {
  switch (it.kind) {
    case 'note': return { w: it.w, h: 90 };
    case 'photo': return { w: it.w, h: it.w * it.ratio + 40 };
    case 'sticker': return { w: it.size, h: it.size };
    case 'song': return { w: it.size, h: it.size + 40 };
    case 'day': return { w: it.w, h: (it.w * 16) / 9 + 50 };
    case 'frame': return { w: it.w, h: it.h };
    case 'mood': return { w: it.size, h: it.size };
    case 'voice': return voiceSize(it);
    case 'arrow': return { w: Math.abs(it.x2 - it.x), h: Math.abs(it.y2 - it.y) };
    case 'stroke': {
      const xs = it.points.filter((_, i) => i % 2 === 0), ys = it.points.filter((_, i) => i % 2 === 1);
      return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
    default: {
      // Новые виды (например, настроение из контракта доски дня) — по полю size, иначе квадрат 160.
      const s = (it as { size?: number }).size ?? 160;
      return { w: s, h: s };
    }
  }
}

/** Пузырь голосового + строки расшифровки под ним (примерно: ~32 знака в строке). */
export function voiceSize(it: { w: number; transcript?: string }): { w: number; h: number } {
  return { w: it.w, h: 80 + (it.transcript ? 30 + Math.ceil(it.transcript.length / 32) * 26 : 0) };
}
