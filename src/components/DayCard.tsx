import Link from 'next/link';
import type { DayRecord } from '@/lib/types';
import { Tilt } from './fx/Tilt';

/** Наклон карточки, когда её «кладут на стол» по прокрутке (ресерч 20.11, M5): свой для каждого дня. */
const tiltFrom = (date: string) => `${((Number(date.slice(8, 10)) * 7) % 13) - 6}deg`;

/** Запечатанная капсула (план 20.11, A5): конверт с маркой и датой открытия. */
function Envelope({ day }: { day: DayRecord }) {
  return (
    <div className="relative flex aspect-[9/16] flex-col items-center justify-center gap-3 overflow-hidden rounded-sm bg-[#e8dcc4] px-3 text-center text-[#4a3a28] shadow-md ring-1 ring-black/10">
      <div className="absolute inset-x-0 top-0 h-1/3 bg-[#dccdb0] [clip-path:polygon(0_0,100%_0,50%_100%)]" aria-hidden />
      <span className="absolute right-3 top-3 grid h-10 w-8 place-items-center border-2 border-dotted border-[#a0522d]/70 bg-[#f4ead6] text-lg" aria-hidden>✉</span>
      <span className="relative mt-6 grid h-10 w-10 place-items-center rounded-full bg-[#8b2e24] font-mono text-[10px] text-[#f4ead6] shadow" aria-hidden>●</span>
      <p className="relative font-mono text-[10px] uppercase tracking-widest opacity-70">капсула времени</p>
      <p className="relative font-hand text-xl leading-tight">откроется {day.sealedUntil?.split('-').reverse().join('.')}</p>
    </div>
  );
}

export function DayCard({ day, large = false, from }: { day: DayRecord; large?: boolean; from?: string }) {
  const href = `/day/${day.id}${from ? `?from=${from}` : ''}`;
  if (day.sealed) {
    return (
      <Link href={href} className="reveal-tilt group block" style={{ '--tilt-from': tiltFrom(day.date) } as React.CSSProperties}>
        <Tilt className="rounded-sm"><Envelope day={day} /></Tilt>
        <div className={`mt-2 ${large ? 'text-lg' : 'text-base'} leading-tight`}>{day.title}</div>
        <div className="font-mono text-[11px] text-muted">{day.date.split('-').reverse().join('.')}</div>
      </Link>
    );
  }
  const cover = day.posterUrl ?? day.photos[0]?.thumbUrl;
  const bg = day.style?.palette.bg ?? '#e9e2d6';
  return (
    <Link href={href} className="reveal-tilt group block" style={{ '--tilt-from': tiltFrom(day.date) } as React.CSSProperties}>
      <Tilt className="rounded-sm">
      <div className="relative aspect-[9/16] overflow-hidden rounded-sm shadow-md ring-1 ring-black/5 transition-shadow group-hover:shadow-2xl" style={{ background: bg }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover && <img src={cover} alt="" loading="lazy" className={`h-full w-full ${day.posterUrl ? 'object-cover' : 'object-cover opacity-80'}`} />}
        {!day.posterUrl && (
          <div className="absolute inset-x-0 top-0 p-3" style={{ color: day.style?.palette.ink }}>
            <p className="font-mono text-[10px] tracking-widest">{day.date.split('-').reverse().join('.')}</p>
            <p className="text-lg font-semibold leading-tight">{day.title}</p>
          </div>
        )}
      </div>
      </Tilt>
      <div className={`mt-2 ${large ? 'text-lg' : 'text-base'} leading-tight`}>{day.title}</div>
      <div className="font-mono text-[11px] text-muted">{day.date.split('-').reverse().join('.')}</div>
    </Link>
  );
}
