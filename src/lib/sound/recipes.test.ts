import { describe, expect, it } from 'vitest';
import type { AtmosphereKind } from '@/lib/types';
import { AMBIENT_LEVEL, soundscapeFor } from './recipes';

const KINDS: AtmosphereKind[] = ['leaves', 'snow', 'rain', 'mist', 'dust', 'lights', 'none'];

describe('soundscapeFor', () => {
  it('у каждой атмосферы, кроме «none», есть свой звук', () => {
    for (const k of KINDS.filter((x) => x !== 'none')) expect(soundscapeFor(k).layers.length).toBeGreaterThan(0);
    expect(soundscapeFor('none').layers).toEqual([]);
  });
  it('дождь — это шум и капли', () => {
    const types = soundscapeFor('rain').layers.map((l) => l.type);
    expect(types).toContain('noise');
    expect(types).toContain('drops');
  });
  it('пыль в луче — тихий треск плёнки', () => {
    expect(soundscapeFor('dust').layers.map((l) => l.type)).toContain('crackle');
  });
  it('звуки дня тихие: под музыкой, не вместо неё', () => {
    expect(AMBIENT_LEVEL).toBeLessThanOrEqual(0.15);
    for (const k of KINDS) for (const l of soundscapeFor(k).layers) {
      expect(l.gain).toBeGreaterThan(0);
      expect(l.gain).toBeLessThanOrEqual(1);
    }
  });
  it('у каждого звука есть подпись для «Почему так»', () => {
    for (const k of KINDS.filter((x) => x !== 'none')) expect(soundscapeFor(k).label.length).toBeGreaterThan(3);
  });
});
