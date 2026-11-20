'use client';
// Обложка дневника на столе: переплёт цвета вида (или последнего дня), тиснёное название, фото-вклейка.
import { DIARY_KINDS, type DiaryMeta } from '@/lib/shelf';

const daysWord = (n: number) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня';
  return 'дней';
};

export function DiaryCover({ meta, example = false }: { meta: DiaryMeta; example?: boolean }) {
  const kind = DIARY_KINDS[meta.kind];
  const cover = kind.cover;
  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-r-md rounded-l-sm text-[#f6efe2] shadow-[6px_10px_24px_rgba(0,0,0,0.35)]"
      style={{ background: `linear-gradient(135deg, ${cover}, color-mix(in srgb, ${cover} 70%, #000))` }}>
      {/* Корешок и фактура ткани */}
      <div className="absolute inset-y-0 left-0 w-[9%] bg-black/25 shadow-[inset_-2px_0_3px_rgba(0,0,0,0.3)]" aria-hidden />
      <div className="absolute inset-0 opacity-[0.18] mix-blend-overlay" aria-hidden
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 4px), repeating-linear-gradient(-45deg, #000 0 1px, transparent 1px 5px)' }} />
      {/* Вклейка: постер последнего дня или цвет его палитры */}
      <div className="absolute left-[24%] right-[14%] top-[8%] h-[47%] -rotate-2 bg-[#fbf8f1] p-1.5 pb-4 shadow-md">
        {meta.lastPosterUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={meta.lastPosterUrl} alt="" className="h-full w-full object-cover object-top" loading="lazy" />
          : <div className="flex h-full w-full items-center justify-center text-3xl" style={{ background: meta.lastColor ?? `color-mix(in srgb, ${cover} 25%, #f4efe6)`, color: cover }}>{kind.icon}</div>}
      </div>
      <div className="absolute inset-x-[14%] bottom-[7%]">
        <p className="font-mono text-[9px] uppercase tracking-[0.25em] opacity-75">{example ? 'пример' : kind.label}</p>
        <p className="mt-0.5 text-xl font-semibold leading-tight [text-shadow:0_1px_0_rgba(0,0,0,0.35)]">{meta.title}</p>
        <p className="mt-1 font-mono text-[10px] opacity-75">{meta.dayCount} {daysWord(meta.dayCount)}</p>
      </div>
    </div>
  );
}
