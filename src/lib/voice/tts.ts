// Синтез речи с интонацией из пресета (A7). Голос выбирают правила системы (pickVoice), здесь — только звук.
// Порядок: OpenAI gpt-4o-mini-tts, если есть OPENAI_API_KEY; иначе Gemini TTS на том же GEMINI_API_KEY,
// что и анализ дня. Нет ни того, ни другого или сервис не ответил — null, и озвучку делает браузер.
import { GoogleGenAI } from '@google/genai';
import type { VoicePreset } from '@/lib/types';
import { withModelFallback } from '@/lib/ai/gemini';
import { trimForSpeech } from './pickVoice';

export interface SpeechAudio { data: Buffer; ext: 'mp3' | 'wav'; contentType: string }

export async function synthesize(text: string, preset: VoicePreset): Promise<SpeechAudio | null> {
  if (process.env.OPENAI_API_KEY) return synthesizeOpenAI(text, preset, process.env.OPENAI_API_KEY);
  if (process.env.GEMINI_API_KEY) return synthesizeGemini(text, preset, process.env.GEMINI_API_KEY);
  return null;
}

async function synthesizeOpenAI(text: string, preset: VoicePreset, key: string): Promise<SpeechAudio> {
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
  return { data: Buffer.from(await res.arrayBuffer()), ext: 'mp3', contentType: 'audio/mpeg' };
}

// ── Gemini TTS ──

/** Модели синтеза речи Gemini: основная и запасные на случай перегрузки. */
export const GEMINI_TTS_MODELS = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview'];

/**
 * Пресеты pickVoice названы голосами OpenAI; у Gemini свои готовые голоса — берём близкие по характеру.
 * Тембр задаёт голос, а интонацию и темп — инструкция пресета в начале запроса.
 */
export const GEMINI_VOICES: Record<string, string> = {
  ash: 'Kore',          // напряжённый день — собранный, твёрдый
  coral: 'Puck',        // насыщенный радостный — живой, с улыбкой
  sage: 'Achernar',     // грустный — мягкий, тихий
  ballad: 'Sulafat',    // день-воспоминание — тёплый
  nova: 'Callirrhoe',   // спокойный — ровный, лёгкий
};
export const geminiVoice = (voice: string) => GEMINI_VOICES[voice] ?? 'Callirrhoe';

/** Как читать — стиль озвучки из пресета (интонация и темп); сам текст записи идёт отдельно, слово в слово. */
export function geminiSpeechStyle(preset: VoicePreset): string {
  const pace = preset.speed < 0.95 ? 'Темп медленнее обычного.' : preset.speed > 1.05 ? 'Темп чуть быстрее обычного.' : 'Обычный темп.';
  return `${preset.instructions} ${pace} Это запись из личного дневника.`;
}

/** Сырой PCM 16 бит (audio/l16, 24 кГц) — заворачиваем в обычный WAV. Модели 3.8 обычно сразу отдают WAV. */
export function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bits = 16): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bits) / 8;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);                       // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE((channels * bits) / 8, 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Звук из ответа Gemini → файл: PCM заворачиваем в WAV (частоту берём из mimeType), готовый mp3/wav отдаём как есть. */
export function toSpeechAudio(base64: string, mimeType = ''): SpeechAudio {
  const raw = Buffer.from(base64, 'base64');
  const mime = mimeType.toLowerCase();
  if (mime.includes('mpeg') || mime.includes('mp3')) return { data: raw, ext: 'mp3', contentType: 'audio/mpeg' };
  if (mime.includes('wav')) return { data: raw, ext: 'wav', contentType: 'audio/wav' };
  const rate = Number(/rate=(\d+)/.exec(mime)?.[1]) || 24000;
  return { data: pcmToWav(raw, rate), ext: 'wav', contentType: 'audio/wav' };
}

// Запрос — как в официальной документации Gemini TTS (Interactions API): голос из готовых 30, стиль — аннотацией,
// ответ — целый WAV 24 кГц моно; русский язык модели поддерживают.
async function synthesizeGemini(text: string, preset: VoicePreset, key: string): Promise<SpeechAudio | null> {
  const ai = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: 'v1beta' } });
  const style = geminiSpeechStyle(preset);
  return withModelFallback(GEMINI_TTS_MODELS, async (model, signal) => {
    const res = await ai.interactions.create({
      model,
      input: [{ type: 'user_input', content: [{ type: 'text', text: trimForSpeech(text), annotations: [{ type: 'speech_metadata', style }] }] }],
      response_format: { type: 'audio', mime_type: 'audio/wav' },
      generation_config: { speech_config: [{ voice: geminiVoice(preset.voice), language: 'ru-RU' }] },
    }, { signal });
    const audio = findAudio(res as unknown as AudioResponse);
    if (!audio) return null;
    return toSpeechAudio(audio.data, audio.mime_type ?? 'audio/wav');
  }, { budgetMs: 52_000, perTryMs: 45_000 });
}

interface AudioPart { type?: string; data?: string; mime_type?: string }

/**
 * Где лежит звук в ответе Interactions API: на деле — в steps[].content[] (type 'audio'),
 * в примере документации — в output_audio. Смотрим оба места.
 */
interface AudioResponse { output_audio?: AudioPart | null; steps?: { content?: unknown }[] | null }

export function findAudio(res: AudioResponse): { data: string; mime_type?: string } | null {
  if (res.output_audio?.data) return { data: res.output_audio.data, mime_type: res.output_audio.mime_type };
  for (const step of res.steps ?? []) {
    const parts = Array.isArray(step.content) ? (step.content as AudioPart[]) : [];
    const part = parts.find((c) => c.type === 'audio' && c.data);
    if (part?.data) return { data: part.data, mime_type: part.mime_type };
  }
  return null;
}
