'use client';
// Страница только для вошедших (план 21.11, часть A): без входа — на /login?next=<эта страница>.
// В локальном режиме (без ключей Supabase) аккаунтов нет — пускаем как раньше, по полке устройства.
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { loginUrl, useAuth } from '@/lib/client/auth';
import { useAuthAvailable } from '@/lib/client/supabase';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const local = !useAuthAvailable();
  useEffect(() => { if (!loading && !user && !local) router.replace(loginUrl(path)); }, [loading, user, local, path, router]);
  if (local || user) return <>{children}</>;
  return <p className="py-24 text-center font-mono text-xs text-muted">{loading ? 'открываю…' : 'перехожу ко входу…'}</p>;
}
