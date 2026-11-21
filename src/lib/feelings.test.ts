import { describe, expect, it } from 'vitest';
import { fallbackAnalysis } from './ai/fallback';
import { applyFeeling, FEELINGS, ZONES } from './feelings';
import { buildStyle } from './style/buildStyle';
import { FIXTURES } from './fixtures';

const base = fallbackAnalysis('Обычный день, работал', '2026-11-10', []);

describe('трекер эмоций', () => {
  it('в каждой из четырёх зон по 6 слов', () => {
    for (const z of Object.keys(ZONES)) expect(FEELINGS.filter((f) => f.zone === z)).toHaveLength(6);
  });

  it('чувство человека сдвигает настроение записи и становится первым словом', () => {
    const calm = applyFeeling(base, 'спокойствие');
    expect(calm.mood.arousal).toBeLessThan(base.mood.arousal);
    expect(calm.moodWords[0]).toBe('спокойствие');
    const tense = applyFeeling(base, 'тревога');
    expect(tense.mood.tension).toBeGreaterThanOrEqual(0.6);
    expect(tense.mood.valence).toBeLessThan(base.mood.valence);
  });

  it('неизвестное или пустое слово ничего не меняет', () => {
    expect(applyFeeling(base, null)).toBe(base);
    expect(applyFeeling(base, 'кракозябра')).toBe(base);
  });

  it('чувство меняет страницу: «восторг» живее, чем «усталость», и объясняется', () => {
    const input = FIXTURES.find((f) => f.name === 'neutral')!.input;
    const joy = buildStyle({ ...input, analysis: applyFeeling(input.analysis, 'восторг'), feeling: 'восторг' });
    const tired = buildStyle({ ...input, analysis: applyFeeling(input.analysis, 'усталость'), feeling: 'усталость' });
    expect(joy.motion.beatsPerPhoto).toBeLessThanOrEqual(tired.motion.beatsPerPhoto);
    expect(joy.reasons.find((r) => r.param === 'feeling')?.because).toContain('восторг');
  });
});
