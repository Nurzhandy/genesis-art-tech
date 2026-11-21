import { describe, expect, it } from 'vitest';
import { ZONES } from '@/lib/feelings';
import { moodColors } from './MoodDrop';

describe('moodColors', () => {
  it('берёт цвет зоны каждого чувства без повторов', () => {
    expect(moodColors(['уют', 'спокойствие', 'восторг'])).toEqual([ZONES.calm.color, ZONES.bright.color]);
  });
  it('незнакомые слова и пустой список — тёплая бумага', () => {
    expect(moodColors(['что-то своё'])).toEqual(['#c8892b']);
    expect(moodColors([])).toEqual(['#c8892b']);
  });
});
