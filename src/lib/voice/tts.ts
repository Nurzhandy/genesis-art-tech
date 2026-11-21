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

/** Запрос к модели: как читать (из пресета) и сам текст записи — без пересказа и добавлений. */
export function geminiSpeechPrompt(text: string, preset: VoicePreset): string {
  const pace = preset.speed < 0.95 ? 'Темп медленнее обычного.' : preset.speed > 1.05 ? 'Темп чуть быстрее обычного.' : 'Обычный темп.';
  return `${preset.instructions} ${pace} Прочитай по-русски запись из личного дневника, слово в слово, ничего не добавляя:\n\n${trimForSpeech(text)}`;
}

/** Gemini отдаёт «сырой» звук PCM 16 бит (audio/L16;rate=24000) — заворачиваем его в обычный WAV. */
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

async function synthesizeGemini(text: string, preset: VoicePreset, key: string): Promise<SpeechAudio | null> {
  const ai = new GoogleGenAI({ apiKey: key });
  const prompt = geminiSpeechPrompt(text, preset);
  return withModelFallback(GEMINI_TTS_MODELS, async (model, signal) => {
    const res = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: geminiVoice(preset.voice) } } },
        abortSignal: signal,
      },
    });
    const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) return null;
    return toSpeechAudio(part.inlineData.data, part.inlineData.mimeType);
  }, { budgetMs: 52_000, perTryMs: 45_000 });
}
