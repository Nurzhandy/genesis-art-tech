'use client';
// «Начать» для всех (21.11): без регистрации. Если на устройстве ещё нет дневника — заводим «Мои дни»
// и открываем /home; аккаунт можно завести потом, чтобы дневник был и на телефоне.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { readShelf } from '@/lib/client/diaryKey';
import { createShelfDiary } from '@/lib/client/diaryId';
import { DIARY_KINDS } from '@/lib/shelf';

export function StartButton({ children, className, feeling }: { children: React.ReactNode; className?: string; feeling?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function start() {
    if (busy) return;
    setBusy(true);
    try {
      if (feeling) sessionStorage.setItem('landing-feeling', feeling);
    } catch { /* не критично */ }
    try {
      if (!readShelf().length) await createShelfDiary(DIARY_KINDS.memories.defaultTitle, 'memories');
    } catch { /* стол сам предложит завести дневник */ }
    router.push('/home');
  }
  return (
    <button type="button" onClick={start} disabled={busy} aria-busy={busy} data-magnetic className={className}>
      {busy ? 'Открываю дневник…' : children}
    </button>
  );
}
