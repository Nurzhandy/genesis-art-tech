'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getOrCreateDiaryId } from '@/lib/client/diaryId';

export function OpenDiaryButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" data-magnetic disabled={busy} onClick={async () => {
        setBusy(true); setError(null);
        try { router.push(`/diary/${await getOrCreateDiaryId()}`); } catch (e) { setError(e instanceof Error ? e.message : 'Не получилось'); setBusy(false); }
      }} className="rounded-full bg-foreground px-8 py-3.5 font-mono text-sm uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90 disabled:opacity-50">
        {busy ? 'открываю…' : 'Мой дневник'}
      </button>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
