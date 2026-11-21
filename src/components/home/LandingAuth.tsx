'use client';
// Лендинг (план 21.11, C1): вошедший человек сразу уходит на /home; в шапке — «Войти» или «Мой стол».
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AUTH_ROUTES, useAuth } from '@/lib/client/auth';

export function LandingRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && user) router.replace(AUTH_ROUTES.home); }, [user, loading, router]);
  return null;
}

const pill = 'rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors';

export function LandingNav() {
  const { user } = useAuth();
  return (
    <nav className="flex items-center gap-1 sm:gap-2" aria-label="Главное меню">
      <Link href="/diary/demo" className={`${pill} hidden text-muted hover:text-foreground sm:inline-block`}>Демо</Link>
      {user ? (
        <Link href={AUTH_ROUTES.home} className={`${pill} bg-foreground text-background hover:opacity-90`}>Мой стол</Link>
      ) : (
        <>
          <Link href={AUTH_ROUTES.login} className={`${pill} text-muted hover:text-foreground`}>Войти</Link>
          <Link href={AUTH_ROUTES.signup} data-magnetic className={`${pill} bg-foreground text-background hover:opacity-90`}>
            <span className="sm:hidden">Начать</span><span className="hidden sm:inline">Начать бесплатно</span>
          </Link>
        </>
      )}
    </nav>
  );
}
