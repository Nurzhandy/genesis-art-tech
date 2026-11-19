import Link from 'next/link';
import { DayForm } from '@/components/DayForm';

export default async function NewDayPage({ params }: PageProps<'/diary/[diaryId]/new'>) {
  const { diaryId } = await params;
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <Link href={`/diary/${diaryId}`} className="font-mono text-xs uppercase tracking-[0.2em] text-muted hover:text-foreground">← дневник</Link>
      <h1 className="mb-10 mt-6 text-5xl font-semibold leading-tight">Запись дня</h1>
      <DayForm diaryId={diaryId} />
    </main>
  );
}
