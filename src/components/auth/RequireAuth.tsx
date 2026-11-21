'use client';
// Страница только для вошедших (план 21.11, часть A): без входа — на /login?next=<эта страница>.
// В локальном режиме (без ключей Supabase) аккаунтов нет — пускаем как раньше, по полке устройства.
// Доступ для всех (21.11): гость с дневником на этом устройстве («Начать» без регистрации) тоже проходит.
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { loginUrl, useAuth } from '@/lib/client/auth';
import { useShelf } from '@/lib/client/diaryKey';
import { useAuthAvailable } from '@/lib/client/supabase';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const local = !useAuthAvailable();
  const shelf = useShelf();
  const guest = !!shelf?.length;
  useEffect(() => { if (!loading && !user && !local && shelf !== undefined && !guest) router.replace(loginUrl(path)); }, [loading, user, local, shelf, guest, path, router]);
  if (local || user || guest) return <>{children}</>;
  return <p className="py-24 text-center font-mono text-xs text-muted">{loading ? 'открываю…' : 'перехожу ко входу…'}</p>;
}
