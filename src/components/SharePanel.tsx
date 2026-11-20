'use client';
// «Поделиться днём» (план 20.11, A4): ссылка-подарок только на просмотр; владелец может её отозвать.
import { useState } from 'react';
import { api } from '@/lib/client/api';
import type { DayRecord } from '@/lib/types';

export function SharePanel({ day, onChange }: { day: DayRecord; onChange: (d: DayRecord) => void }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = day.shareId ? `${window.location.origin}/s/${day.shareId}` : null;

  async function copy(url: string) {
    try {
      if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) await navigator.share({ title: day.title ?? 'День', url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* человек закрыл окно «поделиться» */ }
  }

  async function create() {
    setBusy(true); setError(null);
    try {
      const { shareId } = await api.share(day.id);
      onChange({ ...day, shareId });
      await copy(`${window.location.origin}/s/${shareId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось создать ссылку');
    } finally { setBusy(false); }
  }

  async function revoke() {
    if (!window.confirm('Отозвать ссылку? Кто её получил, больше не сможет открыть день.')) return;
    setBusy(true); setError(null);
    try { await api.unshare(day.id); onChange({ ...day, shareId: null }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не получилось отозвать ссылку'); }
    finally { setBusy(false); }
  }

  return (
    <section className="rounded-sm border border-foreground/15 p-5">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">подарить день</p>
      {link ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input readOnly value={link} aria-label="Ссылка на день" onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 border-b border-foreground/30 bg-transparent py-1 font-mono text-xs outline-none" />
            <button type="button" onClick={() => copy(link)}
              className="rounded-full border border-foreground/30 px-4 py-2 font-mono text-xs uppercase tracking-wider transition hover:bg-foreground hover:text-background">
              {copied ? 'скопировано ✓' : 'копировать'}
            </button>
          </div>
          <p className="text-sm text-muted">По ссылке видно только этот день: воспоминание, текст и голос. Дневник, папка и правки недоступны.</p>
          <button type="button" disabled={busy} onClick={revoke}
            className="self-start font-mono text-[11px] uppercase tracking-wider text-muted underline-offset-4 hover:text-red-700 hover:underline disabled:opacity-40">отозвать ссылку</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" disabled={busy} onClick={create}
            className="rounded-full border border-foreground/30 px-4 py-2 font-mono text-xs uppercase tracking-wider transition hover:bg-foreground hover:text-background disabled:opacity-40">
            {busy ? 'минутку…' : '🎁 Поделиться днём'}
          </button>
          <p className="flex-1 text-sm text-muted">Ссылка откроет только этот день — как открытку.</p>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
    </section>
  );
}
