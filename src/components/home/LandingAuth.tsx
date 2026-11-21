'use client';
// Лендинг: вошедший человек сразу уходит на /home; в шапке — «Начать» (без регистрации), «Войти» или «Мой стол».
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AUTH_ROUTES, useAuth } from '@/lib/client/auth';
import { useShelf } from '@/lib/client/diaryKey';
import { StartButton } from '@/components/landing/StartButton';

export function LandingRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && user) router.replace(AUTH_ROUTES.home); }, [user, loading, router]);
  return null;
}

const pill = 'rounded-full px-4 py-2 text-lg transition-colors';

export function LandingNav() {
  const { user } = useAuth();
  const shelf = useShelf();
  // Дневник уже есть на этом устройстве (гость) или человек вошёл — ведём прямо к столу.
  const hasDesk = !!user || !!shelf?.length;
  return (
    <nav className="flex items-center gap-1 sm:gap-2" aria-label="Главное меню">
      <Link href="/diary/demo" className={`${pill} hidden text-muted hover:text-foreground sm:inline-block`}>Демо</Link>
      {!user && <Link href={AUTH_ROUTES.login} className={`${pill} text-muted hover:text-foreground`}>Войти</Link>}
      {hasDesk ? (
        <Link href={AUTH_ROUTES.home} className={`${pill} bg-foreground text-background hover:opacity-90`}>Мой стол</Link>
      ) : (
        <StartButton className={`${pill} bg-foreground text-background hover:opacity-90 disabled:opacity-60`}>
          <span className="sm:hidden">Начать</span><span className="hidden sm:inline">Начать бесплатно</span>
        </StartButton>
      )}
    </nav>
  );
}
