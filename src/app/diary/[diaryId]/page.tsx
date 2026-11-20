import Link from 'next/link';
import { Archive } from '@/components/Archive';
import { PageFade } from '@/components/fx/PageFade';

export default async function DiaryPage({ params, searchParams }: PageProps<'/diary/[diaryId]'>) {
  const { diaryId } = await params;
  const song = (await searchParams).song;
  const isDemo = diaryId === (process.env.DEMO_DIARY_ID ?? 'demo');
  return (
    <PageFade>
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-muted hover:text-foreground">← дневник атмосферы</Link>
        <h1 className="mb-8 mt-4 text-5xl font-semibold">{isDemo ? 'Демо-дневник' : 'Мой дневник'}</h1>
        <Archive diaryId={diaryId} isDemo={isDemo} songs={typeof song === 'string' ? [song] : song ?? []} />
      </main>
    </PageFade>
  );
}
