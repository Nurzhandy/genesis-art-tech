'use client';
// Доска дня (план 21.11, человек 3): список дней вместе с черновиками для доски дневника.
// Остальные вызовы доски дня — в api.ts (человек 1): createDraftDay, dayBoard, assembleDay.
import { isBoardDraft } from '@/lib/dayboard/layout';
import type { DayRecord } from '@/lib/types';

export { isBoardDraft };

export async function daysWithDrafts(diaryId: string): Promise<DayRecord[]> {
  const res = await fetch(`/api/diaries/${diaryId}/days?drafts=1`);
  if (!res.ok) throw new Error(`Ошибка ${res.status}`);
  const list = (await res.json()) as DayRecord[];
  return list.filter((d) => d.status === 'ready' || isBoardDraft(d));
}
