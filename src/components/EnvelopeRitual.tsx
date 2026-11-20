'use client';
// День приходит письмом (план 20.11, C3): конверт с маркой сезона → клапан открывается → письмо → воспоминание.
import { useState } from 'react';
import { humanDate } from '@/lib/archive';
import { letterExcerpt, SEASON_GLYPH } from '@/lib/ritual';
import type { DayRecord, StyleParams } from '@/lib/types';
import { playPageFlip } from '@/lib/sound/player';

export function EnvelopeRitual({ day, style, onOpen }: { day: DayRecord; style: StyleParams; onOpen: () => void }) {
  const [stage, setStage] = useState<'closed' | 'open'>('closed');
  const season = style.stamps?.season ?? day.analysis?.season ?? 'unknown';
  const open = stage === 'open';

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 overflow-hidden rounded-sm px-6"
      style={{ background: style.palette.bg, color: style.palette.ink }}>
      <p className="font-mono text-xs uppercase tracking-[0.3em] opacity-70">
        {day.sealedUntil ? 'капсула открылась' : 'письмо из прошлого'}
      </p>
      <div className="relative w-full max-w-[300px] [perspective:900px]" style={{ aspectRatio: '4 / 3' }}>
        {/* Письмо выезжает из конверта */}
        <div className="absolute inset-x-4 rounded-[2px] bg-[#fbf8f1] p-4 text-left text-[#3b3226] shadow-md transition-all duration-700 ease-out"
          style={{ top: open ? '-44%' : '12%', bottom: open ? '34%' : '8%', zIndex: open ? 3 : 1, transitionDelay: open ? '350ms' : '0ms' }}>
          <p className="font-mono text-[10px] uppercase tracking-widest opacity-60">{humanDate(day.date)}</p>
          <p className="mt-1 font-hand text-lg leading-snug">{letterExcerpt(day.text, 150)}</p>
        </div>
        {/* Тело конверта */}
        <div className="absolute inset-0 z-[2] rounded-[3px] bg-[#e8dcc4] shadow-xl ring-1 ring-black/10 [clip-path:polygon(0_0,50%_55%,100%_0,100%_100%,0_100%)]" />
        {/* Клапан */}
        <div className="absolute inset-x-0 top-0 h-[58%] origin-top bg-[#dccdb0] transition-transform duration-500 [clip-path:polygon(0_0,100%_0,50%_100%)]"
          style={{ transform: open ? 'rotateX(180deg)' : 'rotateX(0deg)', zIndex: open ? 0 : 4 }} />
        {/* Марка сезона */}
        <span className={`absolute right-3 top-[62%] grid h-12 w-10 ${open ? 'z-[2]' : 'z-[5]'} place-items-center border-2 border-dotted bg-[#f4ead6] text-xl`}
          style={{ borderColor: style.palette.accents[1] ?? style.palette.ink, color: style.palette.accents[1] ?? style.palette.ink }} aria-hidden>
          {SEASON_GLYPH[season]}
        </span>
        <span className="absolute bottom-3 left-4 z-[5] font-hand text-lg text-[#4a3a28]">{day.title}</span>
      </div>
      {!open ? (
        <button type="button" onClick={() => { setStage('open'); playPageFlip(0.22); }}
          className="rounded-full border px-6 py-3 font-mono text-sm uppercase tracking-[0.15em]" style={{ borderColor: style.palette.ink }}>
          ✉ Открыть конверт
        </button>
      ) : (
        <button type="button" onClick={onOpen}
          className="rounded-full border px-6 py-3 font-mono text-sm uppercase tracking-[0.15em]" style={{ borderColor: style.palette.ink }}>
          ▶ Открыть день
        </button>
      )}
    </div>
  );
}
