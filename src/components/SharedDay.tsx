'use client';
// День по ссылке-подарку (план 20.11, A4): воспоминание, текст и голос — без папки, правок и дневника.
import Link from 'next/link';
import type { DayRecord, VoicePreset } from '@/lib/types';
import { ExportPanel } from './ExportPanel';
import { MemoryPlayer } from './MemoryPlayer';
import { PhotoStack } from './PhotoStack';
import { VoiceButton } from './VoiceButton';
import { WhyPanel } from './WhyPanel';

export function SharedDay({ day, preset }: { day: DayRecord; preset: VoicePreset | null }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,440px)_1fr]">
      <MemoryPlayer day={day} savePoster={false} />
      <div className="flex flex-col gap-6">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">вам подарили день</p>
          <h1 className="mt-3 text-5xl font-semibold leading-tight">{day.title}</h1>
          <p className="mt-1 font-mono text-xs text-muted">{day.date.split('-').reverse().join('.')}{day.analysis?.moodWords?.length ? ` · ${day.analysis.moodWords.join(', ')}` : ''}</p>
        </header>
        <p className="whitespace-pre-line text-xl leading-relaxed">{day.text}</p>
        {preset && <VoiceButton day={day} loadVoice={async () => ({ url: day.voice?.url ?? null, preset })} />}
        <PhotoStack day={day} />
        {day.style && <WhyPanel style={day.style} />}
        <ExportPanel day={day} />
        <p className="border-t border-foreground/10 pt-5 text-sm leading-relaxed text-muted">
          Это страница из личного «Дневника атмосферы»: текст, фото и песня дня стали воспоминанием.{' '}
          <Link href="/" className="underline underline-offset-4 hover:text-foreground">Завести свой дневник →</Link>
        </p>
      </div>
    </div>
  );
}
