// Ссылка-подарок (план 20.11, A4): только просмотр дня, без дневника, правок и ключа.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SharedDay } from '@/components/SharedDay';
import { serverToday } from '@/lib/capsule';
import { getDayByShare, withUrls } from '@/lib/db';
import { publicDay, SHARE_ID, sharedCopy, sharedOrNull } from '@/lib/share';
import { pickVoice } from '@/lib/voice/pickVoice';
import { PageFade } from '@/components/fx/PageFade';

export const dynamic = 'force-dynamic';

async function load(shareId: string) {
  if (!SHARE_ID.test(shareId)) return null;
  const day = sharedOrNull(await getDayByShare(shareId), shareId, serverToday());
  if (!day) return null;
  // Подписываем копии из папки подарка, а не файлы дневника (в их пути — ключ владельца).
  const [signed] = await withUrls([sharedCopy(day, shareId).day]);
  return publicDay(signed);
}

export async function generateMetadata({ params }: PageProps<'/s/[shareId]'>): Promise<Metadata> {
  const { shareId } = await params;
  const day = await load(shareId);
  if (!day) return { title: 'Дневник атмосферы', robots: { index: false } };
  const description = day.analysis?.caption || 'День из «Дневника атмосферы»';
  return {
    title: `${day.title} · Дневник атмосферы`,
    description,
    robots: { index: false },
    openGraph: { title: day.title ?? '', description, images: [{ url: `/s/${shareId}/poster`, width: 1080, height: 1920 }] },
  };
}

export default async function SharedPage({ params }: PageProps<'/s/[shareId]'>) {
  const { shareId } = await params;
  const day = await load(shareId);
  if (!day) notFound();
  const preset = day.voice?.preset ?? (day.analysis ? pickVoice(day.analysis, day.music) : null);
  return (
    <PageFade>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
        <SharedDay day={day} preset={preset} />
      </main>
    </PageFade>
  );
}
