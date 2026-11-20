'use client';
// Название дневника в архиве; владелец переименовывает прямо в заголовке.
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { useIsMyDiary } from '@/lib/client/diaryKey';
import { DIARY_KINDS, type DiaryKind } from '@/lib/shelf';

export function DiaryTitle({ diaryId, title: initial, kind, isDemo }: { diaryId: string; title: string; kind: DiaryKind; isDemo: boolean }) {
  const mine = useIsMyDiary(diaryId) && !isDemo;
  const [title, setTitle] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const k = DIARY_KINDS[kind];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try { setTitle((await api.renameDiary(diaryId, draft)).title); setEditing(false); }
    catch (err) { setError(err instanceof Error ? err.message : 'Не получилось переименовать'); }
  }

  return (
    <div className="mb-8 mt-4">
      <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-muted">
        <span className="grid h-5 w-5 place-items-center rounded-sm text-[11px] text-[#f6efe2]" style={{ background: k.cover }}>{k.icon}</span>
        {isDemo ? 'пример' : k.label}
      </p>
      {editing ? (
        <form onSubmit={save} className="mt-2 flex flex-wrap items-center gap-3">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={60} autoFocus aria-label="Название дневника"
            className="min-w-0 flex-1 border-b border-foreground/40 bg-transparent text-5xl font-semibold outline-none focus:border-foreground" />
          <button type="submit" className="font-mono text-xs uppercase tracking-wider underline-offset-4 hover:underline">сохранить</button>
          <button type="button" onClick={() => { setEditing(false); setDraft(title); }} className="font-mono text-xs uppercase tracking-wider text-muted">отмена</button>
          {error && <p className="w-full text-sm text-red-700">{error}</p>}
        </form>
      ) : (
        <h1 className="mt-2 text-5xl font-semibold">
          {title}
          {mine && <button type="button" onClick={() => setEditing(true)} aria-label="Переименовать дневник" title="Переименовать"
            className="ml-3 align-middle font-mono text-sm text-muted hover:text-foreground">✎</button>}
        </h1>
      )}
    </div>
  );
}
