'use client';
import { useRef, useState } from 'react';
import { api } from '@/lib/client/api';
import type { DayRecord, VoicePreset } from '@/lib/types';

export function VoiceButton({ day }: { day: DayRecord }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [preset, setPreset] = useState<VoicePreset | null>(day.voice?.preset ?? null);
  const audio = useRef<HTMLAudioElement | null>(null);

  async function toggle() {
    if (state === 'playing') {
      audio.current?.pause();
      speechSynthesis.cancel();
      setState('idle');
      return;
    }
    setState('loading');
    try {
      const r = await api.voice(day.id);
      setPreset(r.preset);
      if (r.url) {
        audio.current ??= new Audio();
        audio.current.src = r.url;
        audio.current.onended = () => setState('idle');
        await audio.current.play();
      } else {
        // Без ключа TTS — синтез в браузере с той же скоростью из правил.
        const u = new SpeechSynthesisUtterance(day.text);
        u.lang = 'ru-RU';
        u.rate = r.preset.speed;
        u.pitch = r.preset.voice === 'ash' || r.preset.voice === 'coral' ? 1.05 : 0.95;
        const ru = speechSynthesis.getVoices().find((v) => v.lang.startsWith('ru'));
        if (ru) u.voice = ru;
        u.onend = () => setState('idle');
        speechSynthesis.speak(u);
      }
      setState('playing');
    } catch {
      setState('idle');
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={toggle} disabled={state === 'loading'}
        className="self-start rounded-full border border-foreground/30 px-4 py-2 font-mono text-xs uppercase tracking-wider transition hover:bg-foreground hover:text-background disabled:opacity-40">
        {state === 'loading' ? 'готовлю голос…' : state === 'playing' ? '❚❚ остановить' : '◉ Послушать запись'}
      </button>
      {preset && <p className="text-sm text-muted">Голос подобран под настроение: {preset.because}</p>}
    </div>
  );
}
