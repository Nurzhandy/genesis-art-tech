// Свободная доска дневника — главное место новой концепции: сюда открывается дневник со стола.
import { notFound } from 'next/navigation';
import { Board } from '@/components/board/Board';
import { diaryMetas } from '@/lib/diaries';
import { isDiaryId } from '@/lib/db';
import { DIARY_KINDS } from '@/lib/shelf';

export default async function DiaryBoardPage({ params, searchParams }: PageProps<'/diary/[diaryId]/board'>) {
  const { diaryId } = await params;
  const { opened } = await searchParams;
  if (!isDiaryId(diaryId)) notFound();
  const [meta] = await diaryMetas([diaryId]).catch(() => []);
  if (!meta) notFound();
  return <Board diaryId={diaryId} title={meta.title} cover={DIARY_KINDS[meta.kind].cover} opened={opened === '1'} />;
}
