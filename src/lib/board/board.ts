// Свободная доска дневника (новая концепция 20.11): бесконечное пространство, как в Miro.
// Человек кладёт что угодно: заметки, фото, стикеры, рисунок, песни, стрелки, рамки — и карточки дней,
// которые по-прежнему собирает наша система. Координаты — в пикселях доски, цвета — свободные.
import { z } from 'zod';
import { STICKER_SHAPES } from '@/lib/decor/decor';

const Num = z.number().min(-200000).max(200000);
const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const Id = z.string().min(1).max(40);
const base = { id: Id, x: Num, y: Num, rot: z.number().min(-360).max(360).default(0) };
/** Столбиков в волне голосового. */
export const VOICE_BARS = 48;
/** Голосовое на доске — до 3 минут, файл до 8 МБ. */
export const MAX_VOICE_SEC = 180;
export const VOICE_EXT = ['webm', 'ogg', 'm4a', 'mp4', 'mp3', 'wav'] as const;
export type VoiceExt = (typeof VOICE_EXT)[number];
/** Расширение файла для загрузки на доску: голосовое — из белого списка, всё остальное — фото (jpg). */
export const boardFileExt = (ext: string | null): VoiceExt | 'jpg' => ((VOICE_EXT as readonly string[]).includes(ext ?? '') ? (ext as VoiceExt) : 'jpg');
/** Пути файлов доски (фото и голосовые), которым нужны подписанные ссылки на чтение. */
export const boardFilePaths = (b: { items: BoardItem[] }) => b.items.flatMap((i) => (i.kind === 'photo' || i.kind === 'voice' ? [i.path] : []));

export const BoardItemSchema = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('note'), text: z.string().max(2000), w: z.number().min(80).max(1200), color: Color, font: z.enum(['hand', 'serif', 'mono']).default('hand') }),
  z.object({ ...base, kind: z.literal('photo'), path: z.string().min(1).max(300), w: z.number().min(60).max(2000), ratio: z.number().min(0.1).max(10), caption: z.string().max(120).optional() }),
  z.object({ ...base, kind: z.literal('sticker'), shape: z.enum(STICKER_SHAPES), size: z.number().min(30).max(800), color: Color }),
  z.object({ ...base, kind: z.literal('stroke'), points: z.array(z.number().min(-200000).max(200000)).min(2).max(2400), width: z.number().min(1).max(60), color: Color, glow: z.boolean().optional() }),
  z.object({ ...base, kind: z.literal('song'), url: z.string().url().max(500), title: z.string().max(200), cover: z.string().max(500).optional(), preview: z.string().max(500).optional(), size: z.number().min(80).max(600) }),
  z.object({ ...base, kind: z.literal('day'), dayId: z.string().uuid(), w: z.number().min(120).max(900) }),
  z.object({ ...base, kind: z.literal('arrow'), x2: Num, y2: Num, color: Color, width: z.number().min(1).max(20) }),
  z.object({ ...base, kind: z.literal('frame'), w: z.number().min(100).max(10000), h: z.number().min(100).max(10000), title: z.string().max(80), color: Color }),
  // Настроение дня (план 21.11, доска дня): капля с 1–3 чувствами из трекера эмоций (слова из src/lib/feelings.ts).
  z.object({ ...base, kind: z.literal('mood'), feelings: z.array(z.string().trim().min(1).max(40)).min(1).max(3), size: z.number().min(60).max(600) }),
  // Голосовое, как в WhatsApp (21.11): запись своим голосом, волна громкости, расшифровка — слова дня.
  z.object({
    ...base, kind: z.literal('voice'), path: z.string().min(1).max(300), sec: z.number().min(0).max(600),
    peaks: z.array(z.number().min(0).max(1)).max(VOICE_BARS), transcript: z.string().max(4000).optional(), w: z.number().min(200).max(900),
  }),
]);
export const BoardSchema = z.object({ v: z.literal(1), items: z.array(BoardItemSchema).max(400) });

export type BoardItem = z.infer<typeof BoardItemSchema>;
export type Board = z.infer<typeof BoardSchema>;
export const MAX_BOARD_BYTES = 600 * 1024;

export const emptyBoard = (): Board => ({ v: 1, items: [] });
export function normalizeBoard(raw: unknown): Board {
  const r = BoardSchema.safeParse(raw);
  return r.success ? r.data : emptyBoard();
}

/** Дни, которых ещё нет на доске, раскладываются рядком справа от всего, что уже лежит. */
export function placeMissingDays(board: Board, dayIds: string[]): Board {
  const on = new Set(board.items.filter((i) => i.kind === 'day').map((i) => (i as { dayId: string }).dayId));
  const missing = dayIds.filter((id) => !on.has(id));
  if (!missing.length) return board;
  const right = board.items.reduce((m, i) => Math.max(m, i.x + ('w' in i ? (i as { w: number }).w : 200)), 0);
  const startX = board.items.length ? right + 120 : 0;
  const added: BoardItem[] = missing.map((dayId, i) => ({ id: `day-${dayId.slice(0, 8)}`, kind: 'day', dayId, x: startX + i * 320, y: (i % 2) * 40, rot: [-2, 1.5, -1, 2][i % 4], w: 260 }));
  return { v: 1, items: [...board.items, ...added] };
}
