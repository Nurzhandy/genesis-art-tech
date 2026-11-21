'use client';
// Как выглядит элемент доски без редактора: для доски дня на странице дня и для анимации сборки.
// Рисует элемент в его собственной рамке (itemBox), позиционирует снаружи тот, кто вызывает.
import type { StickerShape } from '@/lib/decor/decor';
import { findFeeling, ZONES } from '@/lib/feelings';
import { itemBox, type AnyItem } from '@/lib/dayboard/layout';
import { StickerIcon } from '../decor/StickerIcon';
import { VoiceBubble } from '../board/VoiceNote';
import type { BoardItem } from '@/lib/board/board';

const FONTS: Record<string, string> = { hand: 'font-hand text-2xl leading-snug', serif: 'text-lg leading-snug', mono: 'font-mono text-sm' };

export function strokePath(p: number[]) {
  if (p.length < 4) return `M${p[0]} ${p[1]} l0.1 0`;
  let d = `M${p[0]} ${p[1]}`;
  for (let i = 2; i < p.length - 2; i += 2) d += ` Q${p[i]} ${p[i + 1]} ${(p[i] + p[i + 2]) / 2} ${(p[i + 1] + p[i + 3]) / 2}`;
  return `${d} L${p[p.length - 2]} ${p[p.length - 1]}`;
}

/** Цвета капли-настроения по зонам выбранных чувств. */
export function moodColors(feelings: unknown): string[] {
  const words = Array.isArray(feelings) ? feelings.filter((w): w is string => typeof w === 'string') : [];
  const colors = words.map((w) => findFeeling(w)?.zone).filter(Boolean).map((z) => ZONES[z!].color);
  return colors.length ? colors : ['#c8892b'];
}

export function ItemFace({ it, urls }: { it: AnyItem; urls: Record<string, string> }) {
  const r = it as Record<string, unknown>;
  const box = itemBox(it);
  switch (it.kind) {
    case 'note':
      return (
        <div className={`h-full min-h-[90px] whitespace-pre-wrap rounded-sm px-4 py-3 shadow-md ${FONTS[String(r.font)] ?? FONTS.hand}`}
          // Как на доске-редакторе (BoardCanvas): цвет заметки — оттенок бумаги, чернильный — просто бумага.
          style={{ background: r.color === '#2b241c' || !r.color ? '#fbf8f1' : `color-mix(in srgb, ${String(r.color)} 22%, #fbf8f1)`, color: '#2b241c' }}>
          {String(r.text ?? '')}
        </div>
      );
    case 'photo': {
      const src = urls[String(r.path)];
      return (
        <figure className="h-full bg-[#fbf8f2] p-2 pb-0 shadow-lg ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src ? <img src={src} alt={String(r.caption ?? '')} draggable={false} className="w-full object-cover" style={{ aspectRatio: `1 / ${Number(r.ratio) || 1}` }} />
            : <div className="w-full bg-black/10" style={{ aspectRatio: `1 / ${Number(r.ratio) || 1}` }} />}
          <figcaption className="truncate py-1.5 text-center font-hand text-lg text-[#2b241c]">{String(r.caption ?? '')}</figcaption>
        </figure>
      );
    }
    case 'song': {
      const size = Number(r.size) || 160;
      const cover = typeof r.cover === 'string' ? `/api/music/cover?url=${encodeURIComponent(r.cover)}` : null;
      return (
        <div className="flex flex-col items-center">
          <span className="relative grid place-items-center rounded-full shadow-xl" data-vinyl
            style={{ width: size, height: size, background: 'repeating-radial-gradient(circle, #151311 0 2px, #22201c 2px 4px)' }}>
            <span className="grid h-[38%] w-[38%] place-items-center overflow-hidden rounded-full bg-[#c8892b]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {cover && <img src={cover} alt="" draggable={false} className="h-full w-full object-cover" />}
            </span>
            <span className="absolute h-2 w-2 rounded-full bg-[#f4efe6]" />
          </span>
          <p className="mt-2 max-w-full truncate text-center font-hand text-xl leading-tight">♪ {String(r.title ?? '')}</p>
        </div>
      );
    }
    case 'sticker':
      return <StickerIcon shape={r.shape as StickerShape} color={String(r.color ?? '#2b241c')} paper="#fffaf0" size={Number(r.size) || 80} />;
    case 'stroke': {
      const pts = (r.points as number[]) ?? [];
      const pad = Number(r.width) || 4;
      return (
        <svg width={box.w + pad * 2} height={box.h + pad * 2} viewBox={`${box.x - pad} ${box.y - pad} ${box.w + pad * 2} ${box.h + pad * 2}`}
          style={{ margin: -pad, overflow: 'visible', filter: r.glow ? `drop-shadow(0 0 6px ${String(r.color)})` : undefined }} aria-hidden>
          <path d={strokePath(pts)} fill="none" stroke={String(r.color)} strokeWidth={pad} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    case 'arrow': {
      const x2 = Number(r.x2), y2 = Number(r.y2), a = Math.atan2(y2 - it.y, x2 - it.x), L = 14;
      const head = `M${x2} ${y2} L${x2 - L * Math.cos(a - 0.45)} ${y2 - L * Math.sin(a - 0.45)} M${x2} ${y2} L${x2 - L * Math.cos(a + 0.45)} ${y2 - L * Math.sin(a + 0.45)}`;
      return (
        <svg width={Math.max(box.w, 1)} height={Math.max(box.h, 1)} viewBox={`${box.x} ${box.y} ${Math.max(box.w, 1)} ${Math.max(box.h, 1)}`} style={{ overflow: 'visible' }} aria-hidden>
          <path d={`M${it.x} ${it.y} L${x2} ${y2} ${head}`} fill="none" stroke={String(r.color)} strokeWidth={Number(r.width) || 3} strokeLinecap="round" />
        </svg>
      );
    }
    case 'frame':
      return (
        <div className="h-full rounded-md border-2 border-dashed" style={{ borderColor: String(r.color) }}>
          <span className="-mt-7 block font-mono text-xs uppercase tracking-wider" style={{ color: String(r.color) }}>{String(r.title ?? '')}</span>
        </div>
      );
    case 'mood': {
      const colors = moodColors(r.feelings);
      const words = Array.isArray(r.feelings) ? (r.feelings as string[]).join(' · ') : '';
      return (
        <div className="relative grid h-full w-full place-items-center">
          <span className="absolute inset-0 rounded-[46%_54%_58%_42%/52%_44%_56%_48%] shadow-lg"
            style={{ background: colors.length > 1 ? `conic-gradient(${[...colors, colors[0]].join(',')})` : colors[0] }} />
          <span className="relative px-2 text-center font-hand text-lg leading-tight text-[#2b241c]">{words}</span>
        </div>
      );
    }
    case 'voice': {
      const v = it as Extract<BoardItem, { kind: 'voice' }>;
      return <VoiceBubble item={v} url={urls[v.path]} transcribing={false} editable={false} onTranscript={() => undefined} />;
    }
    case 'day':
      return <div className="h-full rounded-sm bg-[#e9e2d6] shadow-lg" />;
    default:
      return null;
  }
}
