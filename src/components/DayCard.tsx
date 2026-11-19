import Link from 'next/link';
import type { DayRecord } from '@/lib/types';

export function DayCard({ day, large = false }: { day: DayRecord; large?: boolean }) {
  const cover = day.posterUrl ?? day.photos[0]?.thumbUrl;
  const bg = day.style?.palette.bg ?? '#e9e2d6';
  return (
    <Link href={`/day/${day.id}`} className="group block">
      <div className="relative aspect-[9/16] overflow-hidden rounded-sm shadow-md ring-1 ring-black/5 transition group-hover:-translate-y-1 group-hover:shadow-xl" style={{ background: bg }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover && <img src={cover} alt="" loading="lazy" className={`h-full w-full ${day.posterUrl ? 'object-cover' : 'object-cover opacity-80'}`} />}
        {!day.posterUrl && (
          <div className="absolute inset-x-0 top-0 p-3" style={{ color: day.style?.palette.ink }}>
            <p className="font-mono text-[10px] tracking-widest">{day.date.split('-').reverse().join('.')}</p>
            <p className="text-lg font-semibold leading-tight">{day.title}</p>
          </div>
        )}
      </div>
      <div className={`mt-2 ${large ? 'text-lg' : 'text-base'} leading-tight`}>{day.title}</div>
      <div className="font-mono text-[11px] text-muted">{day.date.split('-').reverse().join('.')}</div>
    </Link>
  );
}
