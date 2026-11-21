'use client';
import { useState } from 'react';
import type { StyleParams, Technique } from '@/lib/types';
import { TECHNIQUE_NAMES } from '@/lib/style/techniques';
import { ageEffect, ageReason } from '@/lib/style/visual';
import { localToday } from '@/lib/archive';

const LABELS: Record<string, string> = {
  override: 'Ваша поправка', atmosphere: 'Атмосфера', weather: 'Погода', cover: 'Обложка', stamps: 'Штампы', technique: 'Техника', palette: 'Палитра', motion: 'Ритм', negativeSpace: 'Воздух', grain: 'Зерно', genre: 'Жанр', jitter: 'Движение', songObject: 'Песня', portrait: 'Люди', rhythm: 'Ритм песни', light: 'Свет', wind: 'Ветер', age: 'Возраст', detail: 'Детали', decor: 'Стикеры',
};

/** Сначала коротко: главные причины; остальные — по кнопке, чтобы панель не была простынёй. */
const SHORT = 4;

export function WhyPanel({ style, date }: { style: StyleParams; date?: string }) {
  const [all, setAll] = useState(false);
  // B11 V6: возраст дня меняется со временем — строку считаем при просмотре, а не храним в стиле.
  const age = date ? ageReason(ageEffect(date, localToday())) : null;
  const reasons = age ? [...style.reasons, age] : style.reasons;
  const t = style.techniques;
  const top = (Object.entries(t.scores) as [Technique, number][]).sort((a, b) => b[1] - a[1]);
  return (
    <section className="rounded-sm border border-foreground/15 p-5">
      <h2 className="mb-4 text-2xl font-semibold">Почему этот день выглядит так</h2>
      <div className="mb-4 flex flex-wrap gap-2">
        {[style.palette.bg, style.palette.ink, ...style.palette.accents].map((c, i) => (
          <span key={`${c}-${i}`} title={c} className="h-6 w-6 rounded-full ring-1 ring-foreground/15" style={{ background: c }} />
        ))}
      </div>
      <div className="mb-5 space-y-1.5">
        {top.map(([name, score]) => (
          <div key={name} className="flex items-center gap-2 font-mono text-[11px]">
            <span className={`w-44 shrink-0 ${name === t.primary ? 'text-foreground' : 'text-muted'}`}>{TECHNIQUE_NAMES[name]}</span>
            <span className="h-1.5 flex-1 rounded-full bg-foreground/10">
              <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${Math.min(100, score * 100)}%` }} />
            </span>
          </div>
        ))}
      </div>
      <ul className="space-y-3 text-lg leading-snug">
        {(all ? reasons : reasons.slice(0, SHORT)).map((r) => (
          <li key={r.param}><span className="font-hand text-2xl leading-none text-muted">{LABELS[r.param] ?? r.param}:</span> {r.because}</li>
        ))}
      </ul>
      {reasons.length > SHORT && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all}
          className="mt-4 text-lg text-muted underline decoration-foreground/25 underline-offset-4 hover:text-foreground">
          {all ? 'Свернуть' : `Все причины (${reasons.length})`}
        </button>
      )}
    </section>
  );
}
