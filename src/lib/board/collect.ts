// Доска дня → данные для сборки дня (план 21.11, «день как пустая доска», человек 1).
// Чистая функция: никаких запросов, только раскладка того, что человек положил на доску.
//   заметки (сверху вниз, слева направо) → текст дня
//   фото (первые MAX_PHOTOS в том же порядке) → фото дня
//   первая песня → песня дня, остальные просто лежат на доске
//   капля настроения → чувства (через запятую, как в трекере эмоций)
//   рисунки и стикеры → украшения постера (вписываются в холст 1080×1920)
import type { SongRef } from '@/lib/types';
import { MAX_ITEMS, MAX_POINTS, type Decor, type DecorColor, type DecorItem } from '@/lib/decor/decor';
import { parseSongUrl } from '@/lib/music/parseSongUrl';
import type { Board, BoardItem } from './board';

export const MAX_PHOTOS = 5;
export const EMPTY_BOARD_ERROR = 'Положите на доску хоть что-то: заметку, фото или песню';

const CANVAS = { w: 1080, h: 1920 };
// Украшения не залезают на подпись и шапку постера: рабочая зона страницы.
const SAFE = { x: 90, y: 260, w: 900, h: 1380 };

type Of<K extends BoardItem['kind']> = Extract<BoardItem, { kind: K }>;

export interface CollectedDay {
  text: string;
  photoPaths: string[];
  song: SongRef;
  feeling: string | undefined;
  decor: Decor | null;
}

/** Порядок чтения: сверху вниз, а на одной «строке» (разница по y меньше 40 px) — слева направо. */
export function readingOrder<T extends { x: number; y: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (Math.abs(a.y - b.y) < 40 ? a.x - b.x : a.y - b.y));
}

/** Цвет доски (любой hex) → ближайший цвет палитры дня: тёмные — чернила, светлые — бумага, остальные — акценты. */
export function decorColor(hex: string, i: number): DecorColor {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (l < 0.22) return 'ink';
  if (l > 0.9) return 'paper';
  return (['a0', 'a1', 'a2'] as const)[i % 3];
}

const strokeWidth = (w: number): 2 | 5 | 10 => (w <= 3 ? 2 : w <= 7 ? 5 : 10);

/** Не больше MAX_POINTS точек: прореживаем равномерно, концы сохраняем. */
function thin(points: number[]): number[] {
  const n = points.length / 2;
  if (n <= MAX_POINTS) return points;
  const out: number[] = [];
  for (let k = 0; k < MAX_POINTS; k++) {
    const i = Math.round((k * (n - 1)) / (MAX_POINTS - 1));
    out.push(points[i * 2], points[i * 2 + 1]);
  }
  return out;
}

/** Рисунки и стикеры доски → украшения постера: общая рамка вписывается в рабочую зону страницы. */
export function boardToDecor(items: BoardItem[]): Decor | null {
  const strokes = items.filter((i): i is Of<'stroke'> => i.kind === 'stroke' && i.points.length >= 2);
  const stickers = items.filter((i): i is Of<'sticker'> => i.kind === 'sticker');
  if (!strokes.length && !stickers.length) return null;

  const xs: number[] = [], ys: number[] = [];
  for (const s of strokes) for (let k = 0; k < s.points.length; k += 2) { xs.push(s.x + s.points[k]); ys.push(s.y + s.points[k + 1]); }
  // На доске x, y стикера — левый верхний угол, на постере — центр.
  for (const s of stickers) { xs.push(s.x, s.x + s.size); ys.push(s.y, s.y + s.size); }
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const k = Math.min(1.5, SAFE.w / Math.max(1, maxX - minX), SAFE.h / Math.max(1, maxY - minY));
  const ox = SAFE.x + (SAFE.w - (maxX - minX) * k) / 2 - minX * k;
  const oy = SAFE.y + (SAFE.h - (maxY - minY) * k) / 2 - minY * k;
  const clampX = (v: number) => Math.max(-200, Math.min(CANVAS.w + 200, v));
  const clampY = (v: number) => Math.max(-200, Math.min(CANVAS.h + 200, v));

  const out: DecorItem[] = [];
  readingOrder([...strokes, ...stickers]).forEach((it, i) => {
    if (it.kind === 'stroke') {
      const pts = thin(it.points).map((v, j) => (j % 2 === 0 ? clampX((it.x + v) * k + ox) : clampY((it.y + v) * k + oy)));
      out.push({ id: `b-${it.id}`.slice(0, 40), kind: 'stroke', points: pts.map((v) => Math.min(2120, v)), width: strokeWidth(it.width * k), color: decorColor(it.color, i), ...(it.glow ? { glow: true } : {}) });
    } else {
      out.push({ id: `b-${it.id}`.slice(0, 40), kind: 'sticker', shape: it.shape, x: clampX((it.x + it.size / 2) * k + ox), y: clampY((it.y + it.size / 2) * k + oy),
        scale: Math.max(0.3, Math.min(4, (it.size * k) / 150)), rot: it.rot, color: decorColor(it.color, i) });
    }
  });
  return { v: 1, source: 'user', items: out.slice(0, MAX_ITEMS) };
}

/** Песня с доски → песня дня. Сервис распознаём по ссылке; «Исполнитель — Название» делим на части. */
export function boardSong(it: Of<'song'> | undefined): SongRef {
  if (!it) return { kind: 'none' };
  const [artist, ...rest] = it.title.split(' — ');
  const named = rest.length ? { artist: artist.trim(), title: rest.join(' — ').trim() } : { title: it.title.trim() || undefined };
  return {
    kind: 'link', url: it.url, provider: parseSongUrl(it.url)?.provider ?? 'other', ...named,
    ...(it.cover ? { coverUrl: it.cover } : {}), ...(it.preview ? { previewUrl: it.preview } : {}),
  };
}

/** Всё, что нужно для сборки дня. Пустая доска (нет ни слов, ни фото, ни песни) — ошибка. */
export function collectDay(board: Board): CollectedDay {
  const items = board.items;
  const notes = readingOrder(items.filter((i): i is Of<'note'> => i.kind === 'note' && i.text.trim().length > 0));
  const photos = readingOrder(items.filter((i): i is Of<'photo'> => i.kind === 'photo'));
  const song = readingOrder(items.filter((i): i is Of<'song'> => i.kind === 'song'))[0];
  const mood = readingOrder(items.filter((i): i is Of<'mood'> => i.kind === 'mood'))[0];
  // Подписи к фото — тоже слова дня.
  const captions = photos.map((p) => p.caption?.trim()).filter((c): c is string => !!c);
  const text = [...notes.map((n) => n.text.trim()), ...captions].join('\n\n').slice(0, 5000);
  if (!text && !photos.length && !song) throw new Error(EMPTY_BOARD_ERROR);
  return {
    text,
    photoPaths: photos.slice(0, MAX_PHOTOS).map((p) => p.path),
    song: boardSong(song),
    feeling: mood ? [...new Set(mood.feelings)].join(', ') : undefined,
    decor: boardToDecor(items),
  };
}
