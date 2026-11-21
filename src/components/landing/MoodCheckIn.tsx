'use client';
// «Как вы сегодня?» прямо на первом экране (идея Stoic и How We Feel): попробовать до регистрации.
// Выбрали чувство — страница окрашивается в его цвет, а кнопка зовёт записать именно этот день.
import { useState } from 'react';
import { FEELINGS, ZONES, type Zone } from '@/lib/feelings';
import { StartButton } from './StartButton';

const ORDER: Zone[] = ['bright', 'calm', 'tense', 'low'];
const PICKS: Record<Zone, string[]> = { bright: [], calm: [], tense: [], low: [] };
for (const f of FEELINGS) if (PICKS[f.zone].length < 3) PICKS[f.zone].push(f.word);

const REPLY: Record<Zone, string> = {
  bright: 'Такие дни хочется сохранить целиком — с песней, которая играла.',
  calm: 'Тихие дни помнятся по мелочам: свет, запах, чашка в руках.',
  tense: 'Выпишите это — станет легче, а через год вы увидите, как справились.',
  low: 'Можно просто пару слов. Дневник не оценивает, он бережёт.',
};

export function MoodCheckIn({ onTint }: { onTint?: (color: string | null) => void }) {
  const [pick, setPick] = useState<{ zone: Zone; word: string } | null>(null);
  const choose = (zone: Zone, word: string) => {
    const next = pick?.word === word ? null : { zone, word };
    setPick(next);
    onTint?.(next ? ZONES[next.zone].color : null);
  };
  return (
    <div className="w-full max-w-xl rounded-3xl bg-background/70 p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)] ring-1 ring-foreground/10 backdrop-blur-md sm:p-6">
      <p className="font-hand text-3xl leading-none">Как вы сегодня?</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ORDER.map((z) => (
          <div key={z} className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: ZONES[z].color }} />{ZONES[z].title}
            </span>
            {PICKS[z].map((w) => {
              const on = pick?.word === w;
              return (
                <button key={w} type="button" onClick={() => choose(z, w)} aria-pressed={on}
                  className="rounded-full px-3 py-1.5 text-left text-sm transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
                  style={on ? { background: ZONES[z].color, color: ZONES[z].ink, boxShadow: `0 8px 24px -8px ${ZONES[z].color}` } : { background: `${ZONES[z].color}22` }}>
                  {w}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-5 flex min-h-[3.5rem] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p key={pick?.word ?? 'none'} className="text-base leading-snug text-muted" style={{ animation: 'pop-in 0.4s ease-out both' }}>
          {pick ? REPLY[pick.zone] : 'Выберите слово — без регистрации, просто попробовать.'}
        </p>
        <StartButton feeling={pick?.word} className="shrink-0 rounded-full bg-foreground px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-background transition hover:opacity-90 disabled:opacity-60">
          {pick ? `Записать «${pick.word}» →` : 'Начать запись →'}
        </StartButton>
      </div>
    </div>
  );
}
