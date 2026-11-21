// Главная после входа (план 21.11, часть B): мои дневники, незаконченные доски дней, недавние дни.
import type { Metadata } from 'next';
import { PageFade } from '@/components/fx/PageFade';
import { HomeApp } from '@/components/home-app/HomeApp';

export const metadata: Metadata = { title: 'Мои дневники · Дневник атмосферы', robots: { index: false } };

export default function HomePage() {
  return (
    <PageFade>
      <HomeApp />
    </PageFade>
  );
}
