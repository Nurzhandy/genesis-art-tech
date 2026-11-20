'use client';
// Главная кнопка: рассказать о сегодня голосом. Открывает (или заводит) дневник и сразу запись голосом.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getOrCreateDiaryId } from '@/lib/client/diaryId';

export function TellTodayButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled={busy} onClick={async () => {
        setBusy(true); setError(null);
        try { router.push(`/diary/${await getOrCreateDiaryId()}/new?story=1`); }
        catch (e) { setError(e instanceof Error ? e.message : 'Не получилось открыть дневник'); setBusy(false); }
      }} className="tell-today group flex items-center gap-4 rounded-full bg-foreground py-2.5 pl-2.5 pr-7 text-left text-background shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl disabled:opacity-60">
        <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[color:var(--story-ink)] text-white">
          <span aria-hidden className="tell-pulse absolute inset-0 rounded-full bg-[color:var(--story-ink)]" />
          <svg className="relative" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
          </svg>
        </span>
        <span className="flex flex-col">
          <span className="text-2xl leading-tight">{busy ? 'Открываю дневник…' : 'Рассказать о сегодня'}</span>
          <span className="text-base opacity-70">голосом, за минуту — запись соберётся сама</span>
        </span>
      </button>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
