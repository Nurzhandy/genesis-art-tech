'use client';
// Первый экран лендинга: тёплое «северное сияние» из цветов чувств. Выбрали чувство — сияние перетекает
// в его цвет. Слева — заголовок, вопрос дня и «Как вы сегодня?», справа — машина воспоминаний.
import { useState } from 'react';
import { KineticTitle } from '@/components/home/KineticTitle';
import { MemoryMachine } from '@/components/home/MemoryMachine';
import { DailyPrompt } from './DailyPrompt';
import { MoodCheckIn } from './MoodCheckIn';

const BASE = ['#f6c445', '#e8574a', '#5b7fd1', '#5cb88a'];

export function LandingHero() {
  const [tint, setTint] = useState<string | null>(null);
  const colors = tint ? [tint, tint, tint, tint] : BASE;
  return (
    <section className="relative isolate overflow-hidden">
      <style>{`
        @keyframes aurora-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(6%, 8%) scale(1.15); } }
        @keyframes aurora-b { 0%,100% { transform: translate(0,0) scale(1.1); } 50% { transform: translate(-8%, -4%) scale(0.9); } }
        @media (prefers-reduced-motion: reduce) { .aurora span { animation: none !important; } }
      `}</style>
      <div className="aurora pointer-events-none absolute inset-0 -z-10 opacity-60 dark:opacity-35" aria-hidden>
        {[
          'left-[-10%] top-[-20%] h-[55vh] w-[55vh]', 'right-[-8%] top-[5%] h-[45vh] w-[45vh]',
          'left-[25%] bottom-[-25%] h-[50vh] w-[50vh]', 'right-[20%] bottom-[-10%] h-[35vh] w-[35vh]',
        ].map((pos, i) => (
          <span key={i} className={`absolute rounded-full blur-3xl ${pos}`}
            style={{ background: colors[i], opacity: 0.45, transition: 'background 1.2s ease', animation: `${i % 2 ? 'aurora-b' : 'aurora-a'} ${14 + i * 3}s ease-in-out infinite` }} />
        ))}
      </div>

      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-20 pt-10 sm:pt-16 xl:grid-cols-[1fr_minmax(0,520px)]">
        <div className="flex min-w-0 flex-col items-start gap-6">
          <KineticTitle lines={['Сохраните,', 'как ощущался день']} className="text-5xl font-semibold leading-[0.95] sm:text-7xl" />
          <p className="max-w-lg text-xl leading-relaxed text-muted" style={{ animation: 'pop-in 0.8s ease-out 0.7s both' }}>
            Заметки, фото, песня и голос складываются в живую страницу — в цветах, погоде и ритме того дня.
            Через год откроете и снова почувствуете.
          </p>
          <div style={{ animation: 'pop-in 0.8s ease-out 0.9s both' }}><DailyPrompt /></div>
          <div className="w-full" style={{ animation: 'pop-in 0.8s ease-out 1.1s both' }}><MoodCheckIn onTint={setTint} /></div>
        </div>
        <div className="flex justify-center" style={{ animation: 'pop-in 1s ease-out 0.4s both' }}>
          <MemoryMachine />
        </div>
      </div>
    </section>
  );
}
