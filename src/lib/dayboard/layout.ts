// Доска дня (план 21.11, человек 3): чистая геометрия для «Собрать день», анимации сборки и доски
// только для просмотра. Работает с любым элементом доски, включая будущие виды (например, «настроение»).
import { noteHeight, type BoardItem } from '@/lib/board/board';
import { MAX_PHOTOS, readingOrder } from '@/lib/board/collect';

/** Любой элемент доски: известные виды из BoardSchema и новые из контракта. */
export type AnyItem = BoardItem | ({ kind: string; id: string; x: number; y: number; rot?: number } & Record<string, unknown>);

export interface Box { x: number; y: number; w: number; h: number }

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Рамка элемента на доске (в пикселях доски). */
export function itemBox(it: AnyItem): Box {
  const r = it as Record<string, unknown>;
  if (it.kind === 'stroke' && Array.isArray(r.points) && r.points.length >= 2) {
    const p = r.points as number[];
    const xs = p.filter((_, i) => i % 2 === 0), ys = p.filter((_, i) => i % 2 === 1);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  if (it.kind === 'arrow') {
    const x2 = num(r.x2, it.x), y2 = num(r.y2, it.y);
    return { x: Math.min(it.x, x2), y: Math.min(it.y, y2), w: Math.abs(x2 - it.x), h: Math.abs(y2 - it.y) };
  }
  switch (it.kind) {
    case 'note': { const w = num(r.w, 220); return { x: it.x, y: it.y, w, h: noteHeight(typeof r.text === 'string' ? r.text : '', w) }; }
    case 'photo': { const w = num(r.w, 240); return { x: it.x, y: it.y, w, h: w * num(r.ratio, 1) + 40 }; }
    case 'song': { const s = num(r.size, 160); return { x: it.x, y: it.y, w: s, h: s + 40 }; }
    case 'day': { const w = num(r.w, 260); return { x: it.x, y: it.y, w, h: (w * 16) / 9 + 50 }; }
    case 'frame': return { x: it.x, y: it.y, w: num(r.w, 400), h: num(r.h, 300) };
    case 'voice': { const t = typeof r.transcript === 'string' ? r.transcript : ''; return { x: it.x, y: it.y, w: num(r.w, 340), h: 80 + (t ? 30 + Math.ceil(t.length / 32) * 26 : 0) }; }
    default: { const s = num(r.size, 120); return { x: it.x, y: it.y, w: s, h: s }; } // sticker, mood и всё новое
  }
}

/** Общая рамка всех элементов. Пустая доска даёт null. */
export function boardBox(items: AnyItem[]): Box | null {
  if (!items.length) return null;
  const bs = items.map(itemBox);
  const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
  const r = Math.max(...bs.map((b) => b.x + b.w)), btm = Math.max(...bs.map((b) => b.y + b.h));
  return { x, y, w: Math.max(1, r - x), h: Math.max(1, btm - y) };
}

/** Масштаб и сдвиг, чтобы вписать рамку в область W×H с полями pad. */
export function fitInto(box: Box, W: number, H: number, pad = 24): { s: number; dx: number; dy: number } {
  const s = Math.min((W - pad * 2) / box.w, (H - pad * 2) / box.h, 1.2);
  return { s, dx: (W - box.w * s) / 2 - box.x * s, dy: (H - box.h * s) / 2 - box.y * s };
}

// Порядок чтения берём у collectDay (человек 1), чтобы признаки фото шли ровно в том порядке, что ждёт сервер.
export { readingOrder };

/** Черновик, созданный «＋ день»: текста ещё нет, всё лежит на доске дня. Сломанные дни старой формы сюда не попадают. */
export const isBoardDraft = (d: { status: string; text?: string | null }) => d.status === 'draft' && !d.text?.trim();

/** Есть ли на доске хоть что-то, из чего можно собрать день: заметка с текстом, голосовое, фото или песня (как в collectDay). */
export function hasMaterial(items: AnyItem[]): boolean {
  return items.some((it) => (it.kind === 'note' && String((it as { text?: unknown }).text ?? '').trim().length > 0) || it.kind === 'voice' || it.kind === 'photo' || it.kind === 'song');
}

/** Что именно пойдёт в сборку: первые 5 фото и первая песня в порядке чтения. */
export function assemblyPicks(items: AnyItem[]) {
  const ordered = readingOrder(items);
  return {
    notes: ordered.filter((i) => i.kind === 'note' && String((i as { text?: unknown }).text ?? '').trim()) as Extract<BoardItem, { kind: 'note' }>[],
    /** Голосовые с расшифровкой: их слова тоже ложатся строками на лист. */
    voices: ordered.filter((i) => i.kind === 'voice') as Extract<BoardItem, { kind: 'voice' }>[],
    photos: ordered.filter((i) => i.kind === 'photo').slice(0, MAX_PHOTOS) as Extract<BoardItem, { kind: 'photo' }>[],
    song: (ordered.find((i) => i.kind === 'song') ?? null) as Extract<BoardItem, { kind: 'song' }> | null,
  };
}
