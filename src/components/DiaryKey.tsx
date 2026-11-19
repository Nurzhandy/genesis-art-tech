'use client';
// Ссылка-ключ дневника (A10 / R7). Логина нет: потерять ссылку = потерять дневник, поэтому просим её сохранить.
import { useEffect, useState } from 'react';
import { diaryLink, markKeySaved, rememberDiaryId, useKeySaved, useMyDiaryId } from '@/lib/client/diaryKey';

export function DiaryKey({ diaryId }: { diaryId: string }) {
  const stored = useMyDiaryId();
  const saved = useKeySaved(diaryId);
  const [copied, setCopied] = useState(false);

  // Открыли ссылку-ключ на устройстве без дневника — значит, это владелец на новом устройстве.
  useEffect(() => { if (stored === null) rememberDiaryId(diaryId); }, [stored, diaryId]);

  async function copy() {
    const link = diaryLink(diaryId);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt('Скопируйте ссылку на дневник:', link);
    }
    markKeySaved(diaryId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (stored === undefined || saved === undefined) return null;

  if (stored !== null && stored !== diaryId) {
    return (
      <button type="button" onClick={() => rememberDiaryId(diaryId)}
        className="mb-6 font-mono text-[11px] uppercase tracking-wider text-muted underline-offset-4 hover:text-foreground hover:underline">
        Это мой дневник — запомнить на этом устройстве
      </button>
    );
  }

  return (
    <div className="mb-8">
      {!saved ? (
        <div className="flex flex-wrap items-center gap-3 rounded-sm border border-foreground/20 bg-foreground/[0.03] px-4 py-3">
          <span aria-hidden className="text-xl">🔑</span>
          <p className="min-w-0 flex-1 basis-60 text-base leading-snug">
            Ссылка на эту страницу — единственный ключ к вашему дневнику. Сохраните её, чтобы открыть дневник на другом устройстве.
          </p>
          <button type="button" onClick={copy}
            className="rounded-full bg-foreground px-4 py-2 font-mono text-xs uppercase tracking-wider text-background transition hover:opacity-90">
            Скопировать ссылку
          </button>
          <button type="button" onClick={() => markKeySaved(diaryId)} aria-label="Скрыть напоминание"
            className="px-1 text-muted hover:text-foreground">✕</button>
        </div>
      ) : (
        <button type="button" onClick={copy}
          className="font-mono text-[11px] uppercase tracking-wider text-muted underline-offset-4 hover:text-foreground hover:underline">
          {copied ? 'ссылка скопирована ✓' : '🔑 Сохранить ссылку на дневник'}
        </button>
      )}
    </div>
  );
}
