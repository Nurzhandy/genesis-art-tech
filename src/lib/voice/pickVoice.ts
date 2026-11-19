// Голос озвучки выбирается правилами системы, а не случайно (A7).
import type { DayAnalysis, MusicFeatures, VoicePreset } from '@/lib/types';

const r2 = (v: number) => Math.round(v * 100) / 100;

export function pickVoice(analysis: DayAnalysis, music: MusicFeatures | null): VoicePreset {
  const { valence, arousal, tension, nostalgia } = analysis.mood;
  let p: Omit<VoicePreset, 'speed'> & { speed: number };
  if (tension > 0.6) {
    p = { voice: 'ash', speed: 1.1, instructions: 'Собранно, чуть быстрее, короткие паузы, без драматизма.', because: `напряжённый день (${r2(tension)}) — голос собранный и чуть быстрее` };
  } else if (arousal > 0.6 && valence > 0.2) {
    p = { voice: 'coral', speed: 1.08, instructions: 'Живо, с улыбкой в голосе, как будто рассказываешь другу.', because: 'насыщенный радостный день — живой голос с улыбкой' };
  } else if (valence < -0.2) {
    p = { voice: 'sage', speed: 0.9, instructions: 'Тихо, медленно, с паузами, бережно.', because: 'грустный день — тихий, медленный, бережный голос' };
  } else if (nostalgia > 0.5) {
    p = { voice: 'ballad', speed: 0.93, instructions: 'Тепло и чуть медленно, как будто вспоминаешь вслух.', because: 'день-воспоминание — тёплый голос, как будто вспоминаешь вслух' };
  } else {
    p = { voice: 'nova', speed: 1.0, instructions: 'Спокойно и тепло, как запись в личном дневнике.', because: 'спокойный день — ровный тёплый голос дневника' };
  }
  if (music?.mode === 'minor') {
    p.speed = r2(p.speed - 0.05);
    p.because += ', минорная песня замедляет ещё чуть-чуть';
  }
  return p;
}

export function trimForSpeech(text: string, max = 1500): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'), cut.lastIndexOf('…'));
  return end > max * 0.5 ? cut.slice(0, end + 1) : cut.trimEnd();
}
