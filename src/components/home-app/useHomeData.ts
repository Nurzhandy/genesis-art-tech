'use client';
// Данные главной после входа (план 21.11, часть B): дневники полки, их черновики доски и недавние собранные дни.
import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { useShelf } from '@/lib/client/diaryKey';
import { daysWithDrafts, isBoardDraft } from '@/lib/client/dayBoard';
import type { DiaryMeta } from '@/lib/shelf';
import type { DayRecord } from '@/lib/types';

export interface HomeDay { day: DayRecord; diary: DiaryMeta }
export interface HomeData { diaries: DiaryMeta[]; drafts: HomeDay[]; recent: HomeDay[] }

export const RECENT_LIMIT = 6;

/** Сначала свежие: по дате дня, при равных — по времени создания. */
export function byNewest(a: HomeDay, b: HomeDay): number {
  return b.day.date.localeCompare(a.day.date) || b.day.createdAt.localeCompare(a.day.createdAt);
}

/** Раскладывает дни всех дневников на черновики доски и последние собранные дни. */
export function splitDays(diaries: DiaryMeta[], daysByDiary: DayRecord[][]): Pick<HomeData, 'drafts' | 'recent'> {
  const all = diaries.flatMap((diary, i) => (daysByDiary[i] ?? []).map((day) => ({ day, diary })));
  return {
    drafts: all.filter((x) => isBoardDraft(x.day)).sort(byNewest),
    recent: all.filter((x) => x.day.status === 'ready').sort(byNewest).slice(0, RECENT_LIMIT),
  };
}

/** undefined — ещё грузим; демо-дневник сюда не входит, он лежит на столе примером. */
export function useHomeData(): HomeData | undefined {
  const shelf = useShelf();
  const [data, setData] = useState<HomeData | undefined>(undefined);
  const key = shelf?.join(',') ?? '';

  useEffect(() => {
    if (shelf === undefined) return;
    let alive = true;
    const ids = key ? key.split(',').filter((id) => id !== 'demo') : [];
    (async () => {
      const diaries = ids.length ? await api.shelf(ids).catch(() => [] as DiaryMeta[]) : [];
      const days = await Promise.all(diaries.map((d) => daysWithDrafts(d.id).catch(() => [] as DayRecord[])));
      if (alive) setData({ diaries, ...splitDays(diaries, days) });
    })();
    return () => { alive = false; };
  }, [shelf, key]);

  return data;
}
