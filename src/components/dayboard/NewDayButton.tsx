'use client';
// «＋ день» на доске дневника (план 21.11, человек 3): сразу создаёт пустой черновик и открывает доску дня.
// Если сервер ещё не умеет черновики (или дневник только для чтения), ведём на простую форму.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { localToday } from '@/lib/archive';
import { api } from '@/lib/client/api';

export function NewDayButton({ diaryId, className }: { diaryId: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function start() {
    if (busy) return;
    setBusy(true);
    try {
      const { dayId } = await api.createDraftDay(diaryId, localToday());
      router.push(`/day/${dayId}/board`);
    } catch {
      router.push(`/diary/${diaryId}/new`);
    }
  }
  return (
    <button type="button" onClick={start} disabled={busy} data-magnetic className={className} aria-busy={busy}>
      {busy ? '…' : '＋ день'}
    </button>
  );
}
