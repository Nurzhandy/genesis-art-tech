// Украшения страницы дня (спека 2026-11-20): стикеры, рукописный текст, кисть — поверх воспоминания.
// Координаты в системе холста 1080×1920; цвет — ссылка на палитру дня, поэтому после «Не совсем так?»
// украшения перекрашиваются вместе с днём, а лента остаётся цельной.
import { z } from 'zod';
import type { StyleParams } from '@/lib/types';

export const STICKER_SHAPES = ['tape', 'star', 'heart', 'leaf', 'snowflake', 'sun', 'flower', 'drop',
  'cloud', 'cup', 'note', 'ticket', 'arrow', 'sparkle', 'stamp', 'wave'] as const;
export type StickerShape = (typeof STICKER_SHAPES)[number];

export const DECOR_COLORS = ['ink', 'paper', 'a0', 'a1', 'a2'] as const;
export type DecorColor = (typeof DECOR_COLORS)[number];

export const MAX_ITEMS = 40;
export const MAX_POINTS = 400;
export const MAX_DECOR_BYTES = 64 * 1024;

const X = z.number().min(-200).max(1280);
const Y = z.number().min(-200).max(2120);
const Color = z.enum(DECOR_COLORS);
const Id = z.string().min(1).max(40);

export const StickerItem = z.object({
  id: Id, kind: z.literal('sticker'), shape: z.enum(STICKER_SHAPES),
  x: X, y: Y, scale: z.number().min(0.3).max(4), rot: z.number().min(-360).max(360), color: Color,
});
export const TextItem = z.object({
  id: Id, kind: z.literal('text'), text: z.string().min(1).max(80),
  x: X, y: Y, size: z.number().min(24).max(160), rot: z.number().min(-360).max(360), color: Color,
});
export const StrokeItem = z.object({
  id: Id, kind: z.literal('stroke'),
  points: z.array(z.number().min(-200).max(2120)).min(2).max(MAX_POINTS * 2).refine((p) => p.length % 2 === 0, 'точки парами x,y'),
  width: z.union([z.literal(2), z.literal(5), z.literal(10)]), color: Color,
});
export const DecorItemSchema = z.discriminatedUnion('kind', [StickerItem, TextItem, StrokeItem]);
export const DecorSchema = z.object({ v: z.literal(1), source: z.enum(['auto', 'user']), items: z.array(DecorItemSchema).max(MAX_ITEMS) });

export type DecorItem = z.infer<typeof DecorItemSchema>;
export type Decor = z.infer<typeof DecorSchema>;

export const emptyDecor = (): Decor => ({ v: 1, source: 'auto', items: [] });

/** Что бы ни лежало в базе (старый день, мусор) — получаем корректный слой. */
export function normalizeDecor(raw: unknown): Decor {
  const r = DecorSchema.safeParse(raw);
  return r.success ? r.data : emptyDecor();
}

export function resolveColor(c: DecorColor, palette: StyleParams['palette']): string {
  const a = palette.accents;
  switch (c) {
    case 'ink': return palette.ink;
    case 'paper': return palette.paper;
    case 'a0': return a[0] ?? palette.ink;
    case 'a1': return a[1] ?? a[0] ?? palette.ink;
    case 'a2': return a[2] ?? a[0] ?? palette.ink;
  }
}
