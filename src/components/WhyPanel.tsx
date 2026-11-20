import type { StyleParams, Technique } from '@/lib/types';
import { TECHNIQUE_NAMES } from '@/lib/style/techniques';

const LABELS: Record<string, string> = {
  override: 'Ваша поправка', atmosphere: 'Атмосфера', weather: 'Погода', cover: 'Обложка', technique: 'Техника', palette: 'Палитра', motion: 'Ритм', negativeSpace: 'Воздух', grain: 'Зерно', genre: 'Жанр', jitter: 'Движение', songObject: 'Песня',
};

export function WhyPanel({ style }: { style: StyleParams }) {
  const t = style.techniques;
  const top = (Object.entries(t.scores) as [Technique, number][]).sort((a, b) => b[1] - a[1]);
  return (
    <section className="rounded-sm border border-foreground/15 p-5">
      <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-muted">Почему этот день выглядит так</h2>
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
      <ul className="space-y-2.5 text-[17px] leading-snug">
        {style.reasons.map((r) => (
          <li key={r.param}><span className="font-mono text-[11px] uppercase tracking-wider text-muted">{LABELS[r.param] ?? r.param} · </span>{r.because}</li>
        ))}
      </ul>
    </section>
  );
}
