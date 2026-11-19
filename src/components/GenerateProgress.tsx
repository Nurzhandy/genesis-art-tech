'use client';
import { useEffect, useState } from 'react';

const STEPS = ['Читаю запись…', 'Смотрю на фото…', 'Слушаю песню…', 'Подбираю палитру…', 'Пишу название…', 'Раскладываю папку дня…'];

export function GenerateProgress({ label }: { label?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => Math.min(STEPS.length - 1, v + 1)), 3500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center gap-5 py-16 text-center" role="status" aria-live="polite">
      <div className="relative h-16 w-16">
        <span className="absolute inset-0 animate-ping rounded-full bg-foreground/10" />
        <span className="absolute inset-3 rounded-full bg-foreground/80" />
      </div>
      <p className="font-hand text-3xl">{label ?? STEPS[i]}</p>
      <ol className="font-mono text-xs text-muted">
        {STEPS.map((s, k) => <li key={s} className={k <= i ? 'text-foreground' : ''}>{k < i ? '✓ ' : k === i ? '· ' : '  '}{s.replace('…', '')}</li>)}
      </ol>
    </div>
  );
}
