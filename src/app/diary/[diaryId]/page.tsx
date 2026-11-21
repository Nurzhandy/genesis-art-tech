import Link from 'next/link';
import { Archive } from '@/components/Archive';
import { PageFade } from '@/components/fx/PageFade';
import { DiaryTitle } from '@/components/shelf/DiaryTitle';
import { diaryMetas } from '@/lib/diaries';

export default async function DiaryPage({ params, searchParams }: PageProps<'/diary/[diaryId]'>) {
  const { diaryId } = await params;
  const song = (await searchParams).song;
  const isDemo = diaryId === (process.env.DEMO_DIARY_ID ?? 'demo');
  const [meta] = await diaryMetas([diaryId]).catch(() => []);
  return (
    <PageFade>
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <Link href="/home" className="font-mono text-xs uppercase tracking-[0.2em] text-muted hover:text-foreground">← стол</Link>
        <DiaryTitle diaryId={diaryId} title={meta?.title ?? (isDemo ? 'Демо-дневник' : 'Мой дневник')} kind={meta?.kind ?? 'memories'} isDemo={isDemo} />
        <Archive diaryId={diaryId} isDemo={isDemo} title={meta?.title} songs={typeof song === 'string' ? [song] : song ?? []} />
      </main>
    </PageFade>
  );
}
