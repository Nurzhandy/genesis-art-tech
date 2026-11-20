import Link from 'next/link';
import { notFound } from 'next/navigation';
import { YearView } from '@/components/YearView';
import { PageFade } from '@/components/fx/PageFade';

export default async function YearPage({ params }: PageProps<'/diary/[diaryId]/year/[year]'>) {
  const { diaryId, year } = await params;
  const y = Number(year);
  if (!/^\d{4}$/.test(year) || y < 1990 || y > 2100) notFound();
  return (
    <PageFade>
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <Link href={`/diary/${diaryId}`} className="font-mono text-xs uppercase tracking-[0.2em] text-muted hover:text-foreground">← дневник</Link>
        <h1 className="mb-8 mt-4 text-5xl font-semibold">{y} в цветах</h1>
        <YearView diaryId={diaryId} year={y} />
      </main>
    </PageFade>
  );
}
