import { describe, expect, it } from 'vitest';
import { isOnset, rhythmFromBeat } from './audioReactive';

describe('ритм песни (V2)', () => {
  const calm = Array.from({ length: 30 }, (_, i) => 0.01 + (i % 3) * 0.001);
  it('удар — всплеск потока выше среднего на 1.5σ; ровный звук — не удар', () => {
    expect(isOnset(0.05, calm)).toBe(true);
    expect(isOnset(0.011, calm)).toBe(false);
  });
  it('мало истории или тишина — ударов нет', () => {
    expect(isOnset(0.5, [0.01, 0.01])).toBe(false);
    expect(isOnset(0.001, calm.map(() => 0))).toBe(false);
  });
  it('без живого звука удар — в начале доли, бас дышит раз в долю', () => {
    expect(rhythmFromBeat(0, 0.5).beat).toBe(1);
    expect(rhythmFromBeat(0.5, 0.5).beat).toBeLessThan(0.02);
    expect(rhythmFromBeat(0, 0.5).bass).toBe(1);
    expect(rhythmFromBeat(0.5, 0.5).bass).toBeCloseTo(0, 5);
  });
});
