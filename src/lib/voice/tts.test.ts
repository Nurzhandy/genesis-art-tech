import { afterEach, describe, expect, it, vi } from 'vitest';
import { GEMINI_TTS_MODELS, GEMINI_VOICES, geminiSpeechStyle, geminiVoice, pcmToWav, synthesize, toSpeechAudio } from './tts';

const preset = (voice: string, speed: number) => ({ voice, speed, instructions: 'Тихо и бережно.', because: '' });

describe('Gemini TTS', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('у каждого пресета pickVoice — свой голос Gemini, незнакомый — спокойный по умолчанию', () => {
    const v = ['ash', 'coral', 'sage', 'ballad', 'nova'].map(geminiVoice);
    expect(new Set(v).size).toBe(5);
    expect(geminiVoice('что-то')).toBe(geminiVoice('nova'));
  });

  it('стиль озвучки несёт интонацию и темп пресета', () => {
    const st = geminiSpeechStyle(preset('sage', 0.9));
    expect(st).toContain('Тихо и бережно.');
    expect(st).toContain('медленнее');
  });

  it('голоса и модели — из официального списка Gemini TTS', () => {
    const official = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'];
    for (const v of Object.values(GEMINI_VOICES)) expect(official).toContain(v);
    expect(GEMINI_TTS_MODELS[0]).toBe('gemini-3.8-flash-tts');
  });

  it('PCM заворачивается в корректный WAV с частотой из mimeType', () => {
    const pcm = Buffer.alloc(4800);
    const a = toSpeechAudio(pcm.toString('base64'), 'audio/L16;codec=pcm;rate=24000');
    expect(a.ext).toBe('wav');
    expect(a.data.subarray(0, 4).toString()).toBe('RIFF');
    expect(a.data.subarray(8, 12).toString()).toBe('WAVE');
    expect(a.data.readUInt32LE(24)).toBe(24000);
    expect(a.data.readUInt32LE(40)).toBe(4800);
    expect(a.data.length).toBe(44 + 4800);
    expect(pcmToWav(pcm, 16000).readUInt32LE(28)).toBe(32000);
  });

  it('готовый WAV и mp3 отдаются как есть', () => {
    expect(toSpeechAudio(Buffer.from('RIFF').toString('base64'), 'audio/wav').ext).toBe('wav');
    expect(toSpeechAudio(Buffer.from('ID3').toString('base64'), 'audio/mpeg').ext).toBe('mp3');
  });

  it('без ключей озвучки нет — её сделает браузер', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(await synthesize('день', preset('nova', 1))).toBeNull();
  });
});
