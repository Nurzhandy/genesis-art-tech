'use client';
// Сглаженная громкость живого звука 0..1 через AnalyserNode (B5).
const meters = new WeakMap<HTMLAudioElement, () => number>();

export function createEnergyMeter(audio: HTMLAudioElement): () => number {
  const cached = meters.get(audio);
  if (cached) return cached;
  const ctx = new AudioContext();
  const src = ctx.createMediaElementSource(audio);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  src.connect(analyser);
  analyser.connect(ctx.destination);
  const buf = new Float32Array(analyser.fftSize);
  let smooth = 0;
  const read = () => {
    if (ctx.state === 'suspended') void ctx.resume();
    analyser.getFloatTimeDomainData(buf);
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    const rms = Math.sqrt(s / buf.length);
    smooth = smooth * 0.8 + Math.min(1, rms / 0.25) * 0.2;
    return smooth;
  };
  meters.set(audio, read);
  return read;
}
