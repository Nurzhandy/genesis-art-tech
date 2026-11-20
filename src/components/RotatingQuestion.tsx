'use client';
// Вопрос над полем записи сменяется каждые несколько секунд (ресерч 20.11, W9, по мотивам Stoic):
// подсказывает, о каких деталях рассказать — из деталей потом рождаются подпись, заметки и стикеры.
import { useEffect, useState } from 'react';

export function RotatingQuestion({ questions, paused = false }: { questions: string[]; paused?: boolean }) {
  const [i, setI] = useState(0);
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (paused || questions.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let swap: ReturnType<typeof setTimeout>;
    const t = setInterval(() => {
      setOut(true);
      swap = setTimeout(() => { setI((v) => (v + 1) % questions.length); setOut(false); }, 450);
    }, 3800);
    return () => { clearInterval(t); clearTimeout(swap); };
  }, [paused, questions.length]);
  return (
    <p aria-live="polite" className="mb-3 min-h-[1.3em] text-3xl font-semibold leading-tight transition-all duration-[450ms] ease-out"
      style={{ opacity: out ? 0 : 1, filter: out ? 'blur(6px)' : 'blur(0)', transform: out ? 'translateY(-10px)' : 'none' }}>
      {questions[i]}
    </p>
  );
}
