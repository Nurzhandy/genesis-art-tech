// Регистрация (план 21.11, часть A). Куда вернуть после — в ?next= (только свой адрес внутри сайта).
import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/AuthForm';
import { PageFade } from '@/components/fx/PageFade';
import { safeNext } from '@/lib/authShared';

export const metadata: Metadata = { title: 'Регистрация · Дневник атмосферы' };

export default async function SignupPage({ searchParams }: PageProps<'/signup'>) {
  const { next } = await searchParams;
  return <PageFade><AuthForm mode="signup" next={safeNext(next)} /></PageFade>;
}
