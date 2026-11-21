'use client';
// Доска дня с кнопкой «Собрать день» (план 21.11): доска от человека 2, сборка от человека 3.
import { DayBoard } from '@/components/board/DayBoard';
import { AssembleBar } from './AssembleBar';

export function DayBoardPage({ dayId, opened }: { dayId: string; opened: boolean }) {
  return (
    <DayBoard dayId={dayId} opened={opened} primary={(s) => (
      <AssembleBar dayId={dayId} diaryId={s.day.diaryId} date={s.date} place={s.place} items={s.items} assembled={s.day.status === 'ready'} />
    )} />
  );
}
