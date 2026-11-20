// Стикер в панели редактора — те же формы, что и на холсте.
import type { StickerShape } from '@/lib/decor/decor';
import { SHAPES } from '@/lib/decor/shapes';

export function StickerIcon({ shape, color, paper, size = 34 }: { shape: StickerShape; color: string; paper: string; size?: number }) {
  return (
    <svg viewBox="-8 -8 116 116" width={size} height={size} aria-hidden strokeLinecap="round" strokeLinejoin="round">
      {SHAPES[shape].map((p, i) => <path key={`o${i}`} d={p.d} fill="none" stroke={paper} strokeWidth={(p.w ?? 0) + 9} />)}
      {SHAPES[shape].map((p, i) => p.mode === 'fill'
        ? <path key={i} d={p.d} fill={p.paper ? paper : color} opacity={p.alpha ?? 1} />
        : <path key={i} d={p.d} fill="none" stroke={p.paper ? paper : color} strokeWidth={p.w ?? 4} />)}
    </svg>
  );
}
