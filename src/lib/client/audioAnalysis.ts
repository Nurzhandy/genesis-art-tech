'use client';
// Признаки музыки из файла: BPM, энергия, «яркость» звука (A4). Лад не определяем — его даёт модель.
import type { MusicFeatures } from '@/lib/types';

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export async function analyzeAudioFile(file: File | Blob): Promise<MusicFeatures> {
  const ctx = new AudioContext();
  try {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    const mid = Math.max(0, buffer.duration / 2 - 30);
    const span = Math.min(60, buffer.duration);

    let bpm = 90;
    try {
      const { guess } = await import('web-audio-beat-detector');
      bpm = Math.round((await guess(buffer, mid, span)).bpm);
    } catch { /* тихий трек или короткий файл — оставляем 90 */ }

    const Meyda = (await import('meyda')).default;
    const size = 2048;
    Meyda.bufferSize = size;
    Meyda.sampleRate = buffer.sampleRate;
    const data = buffer.getChannelData(0);
    const start = Math.floor(mid * buffer.sampleRate);
    const end = Math.min(data.length - size, start + Math.floor(span * buffer.sampleRate));
    let rms = 0, centroid = 0, frames = 0;
    for (let i = start; i < end; i += size * 8) {
      const f = Meyda.extract(['rms', 'spectralCentroid'], data.subarray(i, i + size)) as { rms: number; spectralCentroid: number } | null;
      if (!f || !Number.isFinite(f.spectralCentroid)) continue;
      rms += f.rms; centroid += f.spectralCentroid; frames++;
    }
    const n = Math.max(1, frames);
    return {
      source: 'audio',
      bpm: Math.min(200, Math.max(50, bpm)),
      energy: Math.round(clamp(rms / n / 0.25) * 100) / 100,
      mode: 'unknown',
      brightness: Math.round(clamp(centroid / n / (size / 2)) * 100) / 100,
    };
  } finally {
    void ctx.close();
  }
}
