import { describe, expect, it } from 'vitest';
import type { DiaryMeta } from '@/lib/shelf';
import type { DayRecord } from '@/lib/types';
import { greeting } from './HomeApp';
import { plural } from './QuickDay';
import { RECENT_LIMIT, splitDays } from './useHomeData';

const diary = (id: string): DiaryMeta => ({ id, title: id, kind: 'memories', createdAt: '2026-11-01', dayCount: 0, lastColor: null });
const day = (id: string, date: string, status: DayRecord['status'], text = 'текст'): DayRecord =>
  ({ id, diaryId: 'x', date, status, text, title: id, createdAt: `${date}T10:00:00Z`, photos: [] } as unknown as DayRecord);

describe('splitDays', () => {
  it('черновик доски (пустой текст) — в «Продолжить», собранные — в «Недавние», свежие первыми', () => {
    const { drafts, recent } = splitDays([diary('a'), diary('b')], [
      [day('a1', '2026-11-19', 'ready'), day('a2', '2026-11-21', 'draft', '')],
      [day('b1', '2026-11-20', 'ready'), day('b2', '2026-11-18', 'error')],
    ]);
    expect(drafts.map((d) => d.day.id)).toEqual(['a2']);
    expect(recent.map((d) => d.day.id)).toEqual(['b1', 'a1']);
    expect(recent[0].diary.id).toBe('b');
  });
  it(`недавних не больше ${RECENT_LIMIT}`, () => {
    const many = Array.from({ length: 9 }, (_, i) => day(`d${i}`, `2026-11-${String(10 + i).padStart(2, '0')}`, 'ready'));
    expect(splitDays([diary('a')], [many]).recent).toHaveLength(RECENT_LIMIT);
  });
});

describe('greeting', () => {
  it('говорит со временем суток', () => {
    expect(greeting(7)).toBe('Доброе утро');
    expect(greeting(14)).toBe('Добрый день');
    expect(greeting(20)).toBe('Добрый вечер');
    expect(greeting(2)).toBe('Доброй ночи');
  });
});

describe('plural', () => {
  it('день, дня, дней', () => {
    expect([1, 2, 5, 11, 21, 22, 112].map(plural)).toEqual(['день', 'дня', 'дней', 'дней', 'день', 'дня', 'дней']);
  });
});
