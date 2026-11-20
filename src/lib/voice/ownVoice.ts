// Свой голос вместо синтеза (план 20.11, C5): запись в браузере → папка дня → плеер читает её первой.
import type { VoicePreset } from '@/lib/types';

export const OWN_VOICE = 'own';
export const MAX_RECORDING_SEC = 120;
export const RECORDING_EXT = ['webm', 'ogg', 'm4a', 'mp4', 'mp3'] as const;
export type RecordingExt = (typeof RECORDING_EXT)[number];

export const ownVoicePreset = (): VoicePreset => ({ voice: OWN_VOICE, speed: 1, instructions: '', because: 'ваш голос' });
export const isOwnVoice = (p: VoicePreset | null | undefined) => p?.voice === OWN_VOICE;

/** Расширение файла по типу записи браузера: Safari пишет mp4, Chrome и Firefox — webm/ogg. */
export function recordingExt(mime: string): RecordingExt {
  const m = mime.toLowerCase();
  if (m.includes('mp4') || m.includes('aac') || m.includes('m4a')) return 'm4a';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  return 'webm';
}

/** Тип записи, который понимает браузер (по убыванию удобства). */
export function pickRecordingType(isSupported: (t: string) => boolean): string | undefined {
  return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find((t) => isSupported(t));
}
