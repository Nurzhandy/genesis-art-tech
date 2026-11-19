import { DayView } from '@/components/DayView';

export default async function DayPage({ params }: PageProps<'/day/[dayId]'>) {
  const { dayId } = await params;
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <DayView dayId={dayId} />
    </main>
  );
}
