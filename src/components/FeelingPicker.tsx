'use client';
// «Что вы чувствовали?» — шкала настроения как в How We Feel: четыре цветные зоны, в каждой слова-чувства.
// Выбранное слово сдвигает цвета и ритм страницы дня (см. src/lib/feelings.ts).
import { FEELINGS, MAX_FEELINGS, ZONES, type Zone } from '@/lib/feelings';

const ORDER: Zone[] = ['tense', 'bright', 'low', 'calm'];   // сетка: сверху энергия, справа — приятно

// Можно отметить до трёх чувств сразу: день редко бывает одного цвета.
export function FeelingPicker({ value, onChange }: { value: string[]; onChange: (w: string[]) => void }) {
  const toggle = (w: string) => onChange(value.includes(w) ? value.filter((x) => x !== w) : [...value, w].slice(-MAX_FEELINGS));
  return (
    <div>
      <div className="relative grid grid-cols-2 gap-2">
        {ORDER.map((z) => {
          const zone = ZONES[z];
          return (
            <div key={z} className="rounded-2xl p-3 shadow-sm transition" style={{ background: zone.color, color: zone.ink }}>
              <p className="text-lg font-semibold leading-tight">{zone.title}</p>
              <p className="mb-2 text-xs opacity-75">{zone.hint}</p>
              <div className="flex flex-wrap gap-1.5">
                {FEELINGS.filter((f) => f.zone === z).map((f) => {
                  const on = value.includes(f.word);
                  return (
                    <button key={f.word} type="button" aria-pressed={on} onClick={() => toggle(f.word)}
                      className={`rounded-full px-2.5 py-1 text-sm transition ${on ? 'scale-105 bg-white/95 font-semibold text-black shadow-md' : 'bg-black/10 hover:bg-black/20'}`}>
                      {f.word}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <span aria-hidden className="pointer-events-none absolute -left-1 top-1/2 -translate-x-full -translate-y-1/2 -rotate-90 font-mono text-[10px] text-muted max-sm:hidden">энергия ↑</span>
      </div>
      <p className="mt-2 text-sm text-muted">
        {value.length ? <>Вы отметили {value.map((w) => `«${w}»`).join(' и ')}. Страница дня возьмёт цвета и ритм {value.length > 1 ? 'их смеси' : 'этого чувства'}.</> : `Необязательно. Можно отметить до ${MAX_FEELINGS} чувств — день редко бывает одного цвета.`}
      </p>
    </div>
  );
}
