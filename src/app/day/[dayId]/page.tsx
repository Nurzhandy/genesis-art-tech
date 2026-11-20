import { DayView } from '@/components/DayView';
import { PageFade } from '@/components/fx/PageFade';

export default async function DayPage({ params, searchParams }: PageProps<'/day/[dayId]'>) {
  const { dayId } = await params;
  const { from } = await searchParams;
  return (
    <PageFade>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
        <DayView dayId={dayId} from={typeof from === 'string' ? from : null} />
      </main>
    </PageFade>
  );
}
