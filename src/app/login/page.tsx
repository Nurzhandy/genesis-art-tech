// Вход (план 21.11, часть A). Куда вернуть после — в ?next= (только свой адрес внутри сайта).
import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/AuthForm';
import { PageFade } from '@/components/fx/PageFade';
import { safeNext } from '@/lib/authShared';

export const metadata: Metadata = { title: 'Вход · Дневник атмосферы' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams;
  return <PageFade><AuthForm mode="login" next={safeNext(next)} /></PageFade>;
}
