'use client';
// Живой звук → ритм кадра (B5, B11 V2). Один анализатор на <audio>: громкость, полосы и удары.
// Удар ищем по spectral flux (сумма роста спектра) с адаптивным порогом: среднее + 1.5σ за ~1 с.

export interface Rhythm { level: number; bass: number; mid: number; high: number; beat: number }

const meters = new WeakMap<HTMLAudioElement, () => Rhythm>();

/** Чистая функция для тестов: удар, если поток выше среднего на k стандартных отклонений. */
export function isOnset(flux: number, history: number[], k = 1.5, minFlux = 0.002): boolean {
  if (history.length < 8) return false;
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const sd = Math.sqrt(history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length);
  return flux > minFlux && flux > mean + k * sd;
}

/** Без живого звука (постер, экспорт, превью Deezer без CORS) — ритм из BPM стиля. */
export function rhythmFromBeat(beatPhase: number, energy: number): Rhythm {
  const beat = Math.exp(-beatPhase * 9);
  return {
    level: 0.35 + 0.65 * energy * beat,
    bass: 0.5 + 0.5 * Math.cos(2 * Math.PI * beatPhase),
    mid: 0.5,
    high: 0.5 + 0.5 * Math.sin(4 * Math.PI * beatPhase + 1),
    beat,
  };
}

export function createRhythmMeter(audio: HTMLAudioElement): () => Rhythm {
  const cached = meters.get(audio);
  if (cached) return cached;
  const ctx = new AudioContext();
  const src = ctx.createMediaElementSource(audio);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.6;
  src.connect(analyser);
  analyser.connect(ctx.destination);
  const time = new Float32Array(analyser.fftSize);
  const spec = new Uint8Array(analyser.frequencyBinCount);
  const prev = new Float32Array(analyser.frequencyBinCount);
  const hz = ctx.sampleRate / analyser.fftSize;
  const band = (lo: number, hi: number) => {
    const a = Math.max(1, Math.floor(lo / hz)), b = Math.min(spec.length - 1, Math.ceil(hi / hz));
    let s = 0;
    for (let i = a; i <= b; i++) s += spec[i];
    return s / ((b - a + 1) * 255);
  };
  const history: number[] = [];
  let smooth = 0, beat = 0, lastBeat = 0;
  const sm = { bass: 0, mid: 0, high: 0 };
  let last: Rhythm | null = null, lastAt = -1;
  const read = (): Rhythm => {
    // Один замер на кадр: повторный вызов в тот же кадр не должен сбивать поиск ударов.
    const t0 = performance.now();
    if (last && t0 - lastAt < 8) return last;
    lastAt = t0;
    if (ctx.state === 'suspended') void ctx.resume();
    analyser.getFloatTimeDomainData(time);
    analyser.getByteFrequencyData(spec);
    let s = 0;
    for (let i = 0; i < time.length; i++) s += time[i] * time[i];
    smooth = smooth * 0.8 + Math.min(1, Math.sqrt(s / time.length) / 0.25) * 0.2;
    let flux = 0;
    for (let i = 0; i < spec.length; i++) { const v = spec[i] / 255; const d = v - prev[i]; if (d > 0) flux += d; prev[i] = v; }
    flux /= spec.length;
    const now = performance.now();
    if (isOnset(flux, history) && now - lastBeat > 180) { beat = 1; lastBeat = now; }
    else beat *= 0.86;
    history.push(flux);
    if (history.length > 43) history.shift();   // ~0.7–1 с при 45–60 fps
    sm.bass = sm.bass * 0.7 + band(20, 150) * 0.3;
    sm.mid = sm.mid * 0.7 + band(150, 2000) * 0.3;
    sm.high = sm.high * 0.7 + band(2000, 9000) * 0.3;
    last = { level: smooth, bass: sm.bass, mid: sm.mid, high: sm.high, beat };
    return last;
  };
  meters.set(audio, read);
  return read;
}

/** Старый интерфейс: только громкость (используют плеер и обои). */
export function createEnergyMeter(audio: HTMLAudioElement): () => number {
  const r = createRhythmMeter(audio);
  return () => r().level;
}
