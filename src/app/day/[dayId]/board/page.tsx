// Доска дня (план 21.11): пустая свободная доска вместо формы; «Собрать день» превращает её в живую страницу.
import { notFound } from 'next/navigation';
import { DayBoardPage as DayBoardWithAssemble } from '@/components/dayboard/DayBoardPage';
import { isUuid } from '@/lib/db';

export default async function DayBoardPage({ params, searchParams }: PageProps<'/day/[dayId]/board'>) {
  const { dayId } = await params;
  const { opened } = await searchParams;
  if (!isUuid(dayId)) notFound();
  return <DayBoardWithAssemble dayId={dayId} opened={opened === '1'} />;
}
