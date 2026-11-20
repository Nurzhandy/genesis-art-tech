import Link from 'next/link';
import { DayForm } from '@/components/DayForm';
import { PageFade } from '@/components/fx/PageFade';
import { diaryMetas } from '@/lib/diaries';
import { DIARY_KINDS, KIND_QUESTIONS } from '@/lib/shelf';

export default async function NewDayPage({ params, searchParams }: PageProps<'/diary/[diaryId]/new'>) {
  const { diaryId } = await params;
  const story = (await searchParams).story === '1';
  const [meta] = await diaryMetas([diaryId]).catch(() => []);
  return (
    <PageFade>
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
        <Link href={`/diary/${diaryId}`} className="font-mono text-xs uppercase tracking-[0.2em] text-muted hover:text-foreground">← {meta?.title ?? 'дневник'}</Link>
        <h1 className="mb-10 mt-6 text-5xl font-semibold leading-tight">Запись дня</h1>
        <DayForm diaryId={diaryId} prompt={DIARY_KINDS[meta?.kind ?? 'memories'].prompt} questions={KIND_QUESTIONS[meta?.kind ?? 'memories']} startWithStory={story} />
      </main>
    </PageFade>
  );
}
