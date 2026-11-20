// Дневник целиком как книга (по мотивам роликов-«книг нашей истории»): открывается со стола 3D-анимацией обложки.
import { notFound } from 'next/navigation';
import { DiaryBook } from '@/components/shelf/DiaryBook';
import { diaryMetas } from '@/lib/diaries';
import { isDiaryId } from '@/lib/db';
import { DIARY_KINDS } from '@/lib/shelf';

export default async function DiaryBookPage({ params, searchParams }: PageProps<'/diary/[diaryId]/book'>) {
  const { diaryId } = await params;
  const { opened } = await searchParams;
  if (!isDiaryId(diaryId)) notFound();
  const [meta] = await diaryMetas([diaryId]).catch(() => []);
  if (!meta) notFound();
  return <DiaryBook diaryId={diaryId} title={meta.title} cover={DIARY_KINDS[meta.kind].cover} kindLabel={meta.id === 'demo' ? 'пример' : DIARY_KINDS[meta.kind].label} opened={opened === '1'} />;
}
