'use client';
// Синтез звуков дня на Web Audio (план 20.11, B4). Ничего не скачивается: шум, капли, треск, гул.
import type { Layer, Soundscape } from './recipes';

let shared: AudioContext | null = null;
const ctx = () => (shared ??= new AudioContext());

function noiseBuffer(ac: AudioContext, color: 'white' | 'pink' | 'brown', seconds = 3): AudioBuffer {
  const buf = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (color === 'white') d[i] = w * 0.5;
    else if (color === 'pink') { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12; }
    else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
  }
  return buf;
}

function startLayer(ac: AudioContext, layer: Layer, out: AudioNode): () => void {
  const g = ac.createGain();
  g.gain.value = layer.gain;
  g.connect(out);
  if (layer.type === 'noise') {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac, layer.color);
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = layer.filter; f.frequency.value = layer.freq; f.Q.value = layer.q;
    src.connect(f).connect(g);
    let lfo: OscillatorNode | null = null;
    if (layer.lfo) {
      lfo = ac.createOscillator();
      const depth = ac.createGain();
      lfo.frequency.value = layer.lfo.rate;
      depth.gain.value = layer.gain * layer.lfo.depth * 0.5;
      g.gain.value = layer.gain * (1 - layer.lfo.depth * 0.5);
      lfo.connect(depth).connect(g.gain);
      lfo.start();
    }
    src.start();
    return () => { src.stop(); lfo?.stop(); g.disconnect(); };
  }
  if (layer.type === 'hum') {
    const o = ac.createOscillator();
    o.type = 'sine'; o.frequency.value = layer.freq;
    o.connect(g); o.start();
    return () => { o.stop(); g.disconnect(); };
  }
  // Капли и треск: короткие импульсы по таймеру.
  const tick = () => {
    const t = ac.currentTime;
    if (layer.type === 'drops') {
      const o = ac.createOscillator();
      const e = ac.createGain();
      o.frequency.setValueAtTime(layer.freq[0] + Math.random() * (layer.freq[1] - layer.freq[0]), t);
      o.frequency.exponentialRampToValueAtTime(400, t + 0.06);
      e.gain.setValueAtTime(0.0001, t);
      e.gain.exponentialRampToValueAtTime(0.6 * Math.random() + 0.2, t + 0.004);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(e).connect(g); o.start(t); o.stop(t + 0.08);
    } else {
      const s = ac.createBufferSource();
      const b = ac.createBuffer(1, 64, ac.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < 64; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / 64);
      s.buffer = b;
      const e = ac.createGain(); e.gain.value = 0.3 + Math.random() * 0.7;
      s.connect(e).connect(g); s.start(t);
    }
  };
  const perSec = layer.perSec;
  const id = setInterval(() => { if (Math.random() < perSec / 20) tick(); }, 50);
  return () => { clearInterval(id); g.disconnect(); };
}

export interface SoundscapePlayer { setLevel(level: number, ms: number): void; stop(): void }

export function startSoundscape(scape: Soundscape): SoundscapePlayer | null {
  if (!scape.layers.length || typeof window === 'undefined') return null;
  const ac = ctx();
  void ac.resume();
  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(ac.destination);
  const stops = scape.layers.map((l) => startLayer(ac, l, master));
  return {
    setLevel(level, ms) {
      const t = ac.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(Math.max(0, level), t + ms / 1000);
    },
    stop() {
      const t = ac.currentTime;
      master.gain.linearRampToValueAtTime(0, t + 0.4);
      setTimeout(() => { stops.forEach((s) => s()); master.disconnect(); }, 450);
    },
  };
}

/** Шорох перелистывания страницы. */
export function playPageFlip(volume = 0.18): void {
  if (typeof window === 'undefined') return;
  const ac = ctx();
  void ac.resume();
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 'pink', 0.5);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(1200, t);
  f.frequency.exponentialRampToValueAtTime(3800, t + 0.25);
  f.Q.value = 0.9;
  const e = ac.createGain();
  e.gain.setValueAtTime(0.0001, t);
  e.gain.exponentialRampToValueAtTime(volume, t + 0.05);
  e.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  src.connect(f).connect(e).connect(ac.destination);
  src.start(t); src.stop(t + 0.4);
}
