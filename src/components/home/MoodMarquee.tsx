'use client';
// Бегущая строка того, что система прочитала в демо-днях (ресерч 20.11, M10).
import { useMemo } from 'react';
import { TECHNIQUE_NAMES } from '@/lib/style/techniques';
import { demoDays } from './demoDays';

export function MoodMarquee() {
  const chips = useMemo(() => demoDays().flatMap((d) => [
    ...d.moods.map((m) => ({ text: m, color: d.style.palette.accents[0] })),
    { text: `${d.bpm} BPM`, color: d.style.palette.accents[1] ?? d.style.palette.accents[0] },
    { text: TECHNIQUE_NAMES[d.style.techniques.primary], color: d.style.palette.accents[2] ?? d.style.palette.accents[0] },
    { text: `«${d.title}»`, color: d.style.palette.bg },
  ]), []);
  const row = (key: string) => (
    <div key={key} className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={key === 'b'}>
      {chips.map((c, i) => (
        <span key={i} className="flex items-center gap-2 whitespace-nowrap rounded-full border border-foreground/15 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted">
          <span className="h-2 w-2 rounded-full ring-1 ring-black/10" style={{ background: c.color }} />{c.text}
        </span>
      ))}
    </div>
  );
  return (
    <div className="marquee w-full overflow-hidden py-2" aria-label="Что система читает в днях: настроение, темп, техника">
      <div className="marquee-track">{row('a')}{row('b')}</div>
    </div>
  );
}
