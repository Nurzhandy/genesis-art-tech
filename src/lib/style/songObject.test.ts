import { describe, expect, it } from 'vitest';
import { FIXTURES } from '@/lib/fixtures';
import { buildStyle } from './buildStyle';
import { buildSongObject, songObjectKind } from './songObject';

const input = (name: string) => FIXTURES.find((f) => f.name === name)!.input;

describe('песня как предмет (S2)', () => {
  it('носитель по эпохе песни', () => {
    expect(songObjectKind(1957)).toBe('vinyl');
    expect(songObjectKind(1984)).toBe('vinyl');
    expect(songObjectKind(1985)).toBe('cassette');
    expect(songObjectKind(1999)).toBe('cassette');
    expect(songObjectKind(2005)).toBe('cd');
    expect(songObjectKind(2012)).toBe('stream');
    expect(songObjectKind(null)).toBe('stream');
  });

  it('Синатра 1957 года — пластинка, оборот за такт при 76 BPM', () => {
    const o = buildStyle(input('autumn-park')).songObject!;
    expect(o).toEqual({ kind: 'vinyl', year: 1957, revPerSec: 0.317 });
  });

  it('электроника 2019 года — стикер плеера, неизвестный год — тоже', () => {
    expect(buildStyle(input('office-night')).songObject?.kind).toBe('stream');
    expect(buildStyle(input('neutral')).songObject?.kind).toBe('stream');
  });

  it('CD крутится вдвое быстрее пластинки при том же темпе', () => {
    const base = input('autumn-park');
    const cd = buildSongObject({ ...base, music: { ...base.music, year: 2005 } }).songObject;
    expect(cd.kind).toBe('cd');
    expect(cd.revPerSec).toBeCloseTo(2 * 0.317, 2);
  });

  it('объяснение в «Почему так» называет год, предмет и темп', () => {
    const r = buildStyle(input('grandma-old-song')).reasons.find((x) => x.param === 'songObject')!;
    expect(r.because).toContain('1975');
    expect(r.because).toContain('пластинка');
    expect(r.because).toContain('BPM');
  });
});
