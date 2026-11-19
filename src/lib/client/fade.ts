// Плавная громкость музыки: fade-in при открытии дня и приглушение под озвучку (ресерч R4).
export const VOICE_DUCK = 0.25;
export const VOICE_EVENT = 'diary:voice';

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

export function volumeAt(from: number, to: number, elapsedMs: number, durationMs: number): number {
  const k = durationMs <= 0 ? 1 : clamp(elapsedMs / durationMs);
  return clamp(from + (to - from) * easeInOutSine(k));
}

const running = new WeakMap<HTMLMediaElement, number>();

/** Плавно ведёт громкость элемента к target; новый вызов отменяет предыдущий. */
export function fadeVolume(el: HTMLMediaElement, target: number, durationMs: number): void {
  cancelAnimationFrame(running.get(el) ?? 0);
  const from = el.volume;
  const start = performance.now();
  const step = () => {
    const t = performance.now() - start;
    el.volume = volumeAt(from, target, t, durationMs);
    if (t < durationMs) running.set(el, requestAnimationFrame(step));
  };
  running.set(el, requestAnimationFrame(step));
}

/** Озвучка сообщает плееру, что говорит (чтобы приглушить музыку). */
export function announceVoice(speaking: boolean) {
  window.dispatchEvent(new CustomEvent(VOICE_EVENT, { detail: { speaking } }));
}
