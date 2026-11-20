'use client';
// Редактор страницы дня (спека 2026-11-20): стикеры, рукописный текст и кисть поверх воспоминания.
// Цвета — только палитра дня. Всё в координатах холста 1080×1920, поэтому совпадает с постером и видео.
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client/api';
import { DECOR_COLORS, MAX_ITEMS, MAX_POINTS, resolveColor, STICKER_SHAPES, type DecorColor, type DecorItem, type StickerShape } from '@/lib/decor/decor';
import { SHAPE_NAMES } from '@/lib/decor/shapes';
import { LAYOUT } from '@/lib/style/constants';
import type { DayRecord, StyleParams } from '@/lib/types';
import { drawDecorItem, STICKER_BASE } from '@/render/decor';
import { loadFonts } from '@/render/engine';
import type { Fonts } from '@/render/types';
import { songLabel } from '../MemoryPlayer';
import { StickerIcon } from './StickerIcon';

const MemoryCanvas = dynamic(() => import('@/render/MemoryCanvas'), { ssr: false });
const W = LAYOUT.width, H = LAYOUT.height;
const COLOR_NAMES: Record<DecorColor, string> = { ink: 'чернила', paper: 'бумага', a0: 'акцент 1', a1: 'акцент 2', a2: 'акцент 3' };
const BRUSH = [2, 5, 10] as const;
const uid = () => Math.random().toString(36).slice(2, 10);
const btn = 'rounded-full border border-foreground/25 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition hover:bg-foreground hover:text-background disabled:opacity-30';

type Tool = 'move' | 'brush';

export function DecorEditor({ day, style, onSaved, onClose }: { day: DayRecord; style: StyleParams; onSaved: (d: DayRecord) => void; onClose: () => void }) {
  const [items, setItems] = useState<DecorItem[]>(() => day.decor?.items ?? []);
  const [history, setHistory] = useState<DecorItem[][]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('move');
  const [color, setColor] = useState<DecorColor>('a0');
  const [brush, setBrush] = useState<(typeof BRUSH)[number]>(5);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fonts, setFonts] = useState<Fonts | null>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const live = useRef<number[] | null>(null);
  const palette = style.palette;
  const sel = items.find((i) => i.id === selected) ?? null;

  useEffect(() => { void loadFonts().then(setFonts); }, []);

  const commit = useCallback((next: DecorItem[]) => {
    setHistory((h) => [...h.slice(-30), items]);
    setItems(next);
  }, [items]);

  // Перерисовка слоя: все элементы + выделение + текущий штрих кисти.
  const redraw = useCallback(() => {
    const c = overlay.current;
    const g = c?.getContext('2d');
    if (!c || !g || !fonts) return;
    g.clearRect(0, 0, W, H);
    for (const it of items) drawDecorItem(g, it, palette, fonts);
    if (live.current && live.current.length >= 2) {
      drawDecorItem(g, { id: 'live', kind: 'stroke', points: live.current, width: brush, color }, palette, fonts);
    }
    if (sel && sel.kind !== 'stroke') {
      const r = radius(sel, g, fonts);
      g.save();
      g.setLineDash([14, 10]);
      g.lineWidth = 4;
      g.strokeStyle = palette.ink;
      g.beginPath(); g.arc(sel.x, sel.y, r + 14, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
  }, [items, palette, fonts, sel, brush, color]);
  useEffect(redraw, [redraw]);

  const toCanvas = (e: React.PointerEvent) => {
    const r = overlay.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  function hit(x: number, y: number): DecorItem | null {
    const g = overlay.current?.getContext('2d');
    if (!g || !fonts) return null;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.kind === 'stroke') continue;
      if (Math.hypot(x - it.x, y - it.y) <= radius(it, g, fonts)) return it;
    }
    return null;
  }

  function onDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toCanvas(e);
    if (tool === 'brush') {
      if (items.length >= MAX_ITEMS) { setError(`Не больше ${MAX_ITEMS} элементов на странице`); return; }
      live.current = [Math.round(p.x), Math.round(p.y)];
      return;
    }
    const it = hit(p.x, p.y);
    setSelected(it?.id ?? null);
    if (it && it.kind !== 'stroke') {
      drag.current = { id: it.id, dx: p.x - it.x, dy: p.y - it.y, moved: false };
      setText(it.kind === 'text' ? it.text : text);
    }
  }

  function onMove(e: React.PointerEvent) {
    const p = toCanvas(e);
    if (tool === 'brush' && live.current) {
      const pts = live.current;
      const lx = pts[pts.length - 2], ly = pts[pts.length - 1];
      if (Math.hypot(p.x - lx, p.y - ly) < 6) return;
      pts.push(Math.round(p.x), Math.round(p.y));
      if (pts.length >= MAX_POINTS * 2) finishStroke(true);
      redraw();
      return;
    }
    const d = drag.current;
    if (!d) return;
    if (!d.moved) { setHistory((h) => [...h.slice(-30), items]); d.moved = true; }
    setItems((list) => list.map((it) => (it.id === d.id && it.kind !== 'stroke' ? { ...it, x: Math.round(p.x - d.dx), y: Math.round(p.y - d.dy) } : it)));
  }

  function finishStroke(continueAfter = false) {
    const pts = live.current;
    live.current = continueAfter && pts ? [pts[pts.length - 2], pts[pts.length - 1]] : null;
    if (pts && pts.length >= 2) commit([...items, { id: uid(), kind: 'stroke', points: pts, width: brush, color }]);
  }

  function onUp() {
    if (tool === 'brush') finishStroke();
    drag.current = null;
  }

  function add(it: DecorItem) {
    if (items.length >= MAX_ITEMS) { setError(`Не больше ${MAX_ITEMS} элементов на странице`); return; }
    setError(null);
    commit([...items, it]);
    setSelected(it.id);
    setTool('move');
  }

  // Новое кладём в свободное место у центра, со случайным лёгким наклоном — как настоящие наклейки.
  const spot = () => ({ x: Math.round(W * (0.35 + Math.random() * 0.3)), y: Math.round(H * (0.35 + Math.random() * 0.3)), rot: Math.round(Math.random() * 24 - 12) });
  const addSticker = (shape: StickerShape) => add({ id: uid(), kind: 'sticker', shape, scale: 1, color, ...spot() });
  function addText() {
    const t = text.trim().slice(0, 80);
    if (!t) return;
    if (sel?.kind === 'text') { commit(items.map((it) => (it.id === sel.id ? { ...it, text: t } : it))); return; }
    add({ id: uid(), kind: 'text', text: t, size: 64, color: 'ink', ...spot() });
  }

  const update = (patch: (it: DecorItem) => DecorItem) => sel && commit(items.map((it) => (it.id === sel.id ? patch(it) : it)));
  const resize = (k: number) => update((it) => it.kind === 'sticker' ? { ...it, scale: clamp(it.scale * k, 0.3, 4) } : it.kind === 'text' ? { ...it, size: clamp(Math.round(it.size * k), 24, 160) } : it);
  const rotate = (deg: number) => update((it) => (it.kind === 'stroke' ? it : { ...it, rot: ((it.rot + deg + 540) % 360) - 180 }));
  const remove = () => { if (!sel) return; commit(items.filter((it) => it.id !== sel.id)); setSelected(null); };
  const recolor = (c: DecorColor) => { setColor(c); if (sel) update((it) => ({ ...it, color: c })); };
  const undo = () => { const prev = history[history.length - 1]; if (!prev) return; setHistory((h) => h.slice(0, -1)); setItems(prev); setSelected(null); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); remove(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function save() {
    setSaving(true); setError(null);
    try {
      onSaved(await api.saveDecor(day.id, { v: 1, source: 'user', items }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось сохранить');
      setSaving(false);
    }
  }

  const photos = day.photos.map((p) => p.url ?? p.thumbUrl ?? '').filter(Boolean);
  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto w-full max-w-[420px] select-none">
        <MemoryCanvas style={style} photos={photos} playing={false}
          info={{ title: day.title ?? '', caption: day.analysis?.caption ?? '', date: day.date, dayNumber: day.dayNumber, songLabel: songLabel(day), notes: day.analysis?.sensory }}
          className="rounded-sm shadow-2xl" />
        <canvas ref={overlay} width={W} height={H} aria-label="Слой украшений: перетаскивайте стикеры и текст, рисуйте кистью"
          className={`absolute inset-0 h-full w-full touch-none rounded-sm ${tool === 'brush' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onWheel={(e) => { if (!sel) return; e.preventDefault(); if (e.shiftKey) rotate(e.deltaY > 0 ? 8 : -8); else resize(e.deltaY > 0 ? 0.92 : 1.08); }} />
      </div>

      <div className="mx-auto flex w-full max-w-[420px] flex-col gap-3 rounded-md border border-foreground/15 bg-background/80 p-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={`${btn} ${tool === 'move' ? 'bg-foreground text-background' : ''}`} onClick={() => setTool('move')}>✥ двигать</button>
          <button type="button" className={`${btn} ${tool === 'brush' ? 'bg-foreground text-background' : ''}`} onClick={() => { setTool('brush'); setSelected(null); }}>✎ кисть</button>
          {tool === 'brush' && BRUSH.map((b) => (
            <button key={b} type="button" aria-label={`Толщина ${b}`} onClick={() => setBrush(b)}
              className={`grid h-7 w-7 place-items-center rounded-full border ${brush === b ? 'border-foreground' : 'border-foreground/20'}`}>
              <span className="rounded-full bg-current" style={{ width: b + 2, height: b + 2 }} />
            </button>
          ))}
          <span className="ml-auto flex gap-1.5" role="radiogroup" aria-label="Цвет из палитры дня">
            {DECOR_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} title={COLOR_NAMES[c]} onClick={() => recolor(c)}
                className={`h-6 w-6 rounded-full ring-1 ring-black/15 transition ${color === c ? 'scale-110 outline outline-2 outline-offset-2 outline-current' : ''}`}
                style={{ background: resolveColor(c, palette) }} />
            ))}
          </span>
        </div>

        <div className="grid grid-cols-8 gap-1" aria-label="Стикеры">
          {STICKER_SHAPES.map((s) => (
            <button key={s} type="button" title={SHAPE_NAMES[s]} aria-label={`Стикер: ${SHAPE_NAMES[s]}`} onClick={() => addSticker(s)}
              className="grid aspect-square place-items-center rounded-md transition hover:scale-110 hover:bg-foreground/[0.06]">
              <StickerIcon shape={s} color={resolveColor(color, palette)} paper={palette.paper} />
            </button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); addText(); }} className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder={sel?.kind === 'text' ? 'изменить надпись' : 'рукописная заметка…'}
            className="min-w-0 flex-1 border-b border-foreground/30 bg-transparent py-1 font-hand text-2xl outline-none placeholder:text-muted/60 focus:border-foreground" />
          <button type="submit" className={btn} disabled={!text.trim()}>{sel?.kind === 'text' ? 'изменить' : '+ текст'}</button>
        </form>

        {sel && sel.kind !== 'stroke' && (
          <div className="flex flex-wrap items-center gap-2 border-t border-foreground/10 pt-3">
            <span className="font-mono text-[11px] text-muted">выбрано:</span>
            <button type="button" className={btn} onClick={() => resize(0.85)} aria-label="Меньше">−</button>
            <button type="button" className={btn} onClick={() => resize(1.18)} aria-label="Больше">+</button>
            <button type="button" className={btn} onClick={() => rotate(-15)} aria-label="Повернуть влево">↺</button>
            <button type="button" className={btn} onClick={() => rotate(15)} aria-label="Повернуть вправо">↻</button>
            <button type="button" className={`${btn} ml-auto hover:!bg-red-700`} onClick={remove}>удалить</button>
          </div>
        )}

        {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
        <div className="flex flex-wrap items-center gap-2 border-t border-foreground/10 pt-3">
          <button type="button" className={btn} onClick={undo} disabled={!history.length}>↶ отменить</button>
          <button type="button" className={btn} onClick={() => { if (items.length && window.confirm('Убрать все украшения со страницы?')) { commit([]); setSelected(null); } }} disabled={!items.length}>очистить</button>
          <span className="font-mono text-[10px] text-muted">{items.length}/{MAX_ITEMS}</span>
          <button type="button" className="ml-auto font-mono text-xs uppercase tracking-wider text-muted hover:text-foreground" onClick={onClose}>отмена</button>
          <button type="button" data-magnetic disabled={saving} onClick={save}
            className="rounded-full bg-foreground px-5 py-2 font-mono text-xs uppercase tracking-[0.15em] text-background disabled:opacity-50">
            {saving ? 'сохраняю…' : 'сохранить'}
          </button>
        </div>
        <p className="text-xs text-muted">Колёсико над выбранным — размер, с Shift — поворот. Delete — удалить, ⌘/Ctrl+Z — отменить.</p>
      </div>
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function radius(it: DecorItem, g: CanvasRenderingContext2D, fonts: Fonts): number {
  if (it.kind === 'sticker') return (STICKER_BASE * it.scale) / 2;
  if (it.kind === 'text') {
    g.save();
    g.font = `500 ${it.size}px ${fonts.hand}`;
    const w = g.measureText(it.text).width;
    g.restore();
    return Math.max(w / 2, it.size / 2);
  }
  return 0;
}
