'use client';
// Вопрос дня (идея Stoic): лендинг каждый день немного другой. Вопросы сменяют друг друга мягко.
import { useEffect, useState, useSyncExternalStore } from 'react';

const PROMPTS = [
  'Что сегодня пахло по-особенному?',
  'Какая песня крутилась в голове?',
  'Кто был рядом и что он сказал?',
  'Какого цвета было небо вечером?',
  'Какая мелочь сегодня порадовала?',
  'Что вы хотите вспомнить через год?',
  'Где было теплее всего?',
];
const noop = () => () => {};

export function DailyPrompt() {
  // Дата и стартовый вопрос — только в браузере, чтобы не спорить с сервером о часовом поясе.
  const today = useSyncExternalStore(noop, () => new Date().toDateString(), () => null);
  const start = today ? Math.floor(new Date(today).getTime() / 86400000) % PROMPTS.length : 0;
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setStep((s) => s + 1), 3800);
    return () => clearInterval(t);
  }, []);
  const label = today ? new Date(today).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : '';
  return (
    <div className="flex items-center gap-3 text-muted">
      <span className="text-lg">Вопрос дня{label ? `, ${label}` : ''}</span>
      <span className="h-px w-6 bg-foreground/20" />
      <span key={step} className="font-hand text-2xl leading-none text-foreground" style={{ animation: 'pop-in 0.6s ease-out both' }}>
        {PROMPTS[(start + step) % PROMPTS.length]}
      </span>
    </div>
  );
}
