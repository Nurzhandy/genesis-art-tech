// Синтез речи OpenAI gpt-4o-mini-tts с интонацией из пресета (A7).
import type { VoicePreset } from '@/lib/types';
import { trimForSpeech } from './pickVoice';

export async function synthesize(text: string, preset: VoicePreset): Promise<Buffer | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: preset.voice,
      input: trimForSpeech(text),
      instructions: `${preset.instructions} Говори по-русски.`,
      response_format: 'mp3',
      speed: preset.speed,
    }),
    signal: AbortSignal.timeout(50_000),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}
