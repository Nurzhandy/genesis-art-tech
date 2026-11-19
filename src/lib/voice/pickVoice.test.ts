import { describe, expect, it } from 'vitest';
import type { DayAnalysis, MusicFeatures } from '@/lib/types';
import { fallbackAnalysis } from '@/lib/ai/fallback';
import { pickVoice, trimForSpeech } from './pickVoice';

const a = (mood: Partial<DayAnalysis['mood']>): DayAnalysis => {
  const base = fallbackAnalysis('день', '2026-10-01', []);
  return { ...base, mood: { valence: 0, arousal: 0.4, tension: 0.1, nostalgia: 0.1, ...mood } };
};
const major: MusicFeatures = { source: 'llm', bpm: 90, energy: 0.5, mode: 'major' };
const minor: MusicFeatures = { ...major, mode: 'minor' };

describe('pickVoice', () => {
  it('напряжённый день — собранный голос чуть быстрее', () => {
    expect(pickVoice(a({ tension: 0.8 }), major)).toMatchObject({ voice: 'ash', speed: 1.1 });
  });
  it('радостный энергичный день — живой голос', () => {
    expect(pickVoice(a({ arousal: 0.8, valence: 0.6 }), major)).toMatchObject({ voice: 'coral', speed: 1.08 });
  });
  it('грустный день — тихий медленный голос', () => {
    expect(pickVoice(a({ valence: -0.5 }), major)).toMatchObject({ voice: 'sage', speed: 0.9 });
  });
  it('ностальгия — тёплый голос воспоминания', () => {
    expect(pickVoice(a({ nostalgia: 0.7 }), major)).toMatchObject({ voice: 'ballad', speed: 0.93 });
  });
  it('обычный день — спокойный тёплый голос', () => {
    expect(pickVoice(a({}), major)).toMatchObject({ voice: 'nova', speed: 1 });
  });
  it('минор замедляет на 0.05', () => {
    expect(pickVoice(a({}), minor).speed).toBeCloseTo(0.95);
  });
  it('объясняет выбор человеческими словами', () => {
    expect(pickVoice(a({ tension: 0.8 }), minor).because).toMatch(/напряж/);
  });
});

describe('trimForSpeech', () => {
  it('короткий текст не трогает', () => {
    expect(trimForSpeech('Привет. Пока.', 1500)).toBe('Привет. Пока.');
  });
  it('длинный обрезает по последнему предложению', () => {
    const t = 'Раз. '.repeat(400);
    const out = trimForSpeech(t, 1500);
    expect(out.length).toBeLessThanOrEqual(1500);
    expect(out.endsWith('.')).toBe(true);
  });
});
