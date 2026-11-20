'use client';
// «+ новый дневник»: название и вид. Вид меняет обложку и подсказку в записи, правила стиля общие.
import { useEffect, useRef, useState } from 'react';
import { createShelfDiary } from '@/lib/client/diaryId';
import { DIARY_KINDS, type DiaryKind } from '@/lib/shelf';

const KINDS = Object.entries(DIARY_KINDS) as [DiaryKind, (typeof DIARY_KINDS)[DiaryKind]][];

export function NewDiaryDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<DiaryKind>('memories');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const id = await createShelfDiary(title.trim() || DIARY_KINDS[kind].defaultTitle, kind);
      setTitle(''); setKind('memories');
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не получилось создать дневник');
    } finally { setBusy(false); }
  }

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="m-auto w-[min(92vw,520px)] rounded-md bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm open:animate-[pop-in_0.35s_ease-out]">
      <form onSubmit={submit} className="flex flex-col gap-6 p-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">новый дневник</p>
          <h2 className="mt-1 text-3xl font-semibold">Для чего он?</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Вид дневника">
          {KINDS.map(([k, v]) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-left transition ${kind === k ? 'border-foreground bg-foreground/[0.06]' : 'border-foreground/15 hover:border-foreground/40'}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-base text-[#f6efe2]" style={{ background: v.cover }}>{v.icon}</span>
              <span className="text-base leading-tight">{v.label}</span>
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">название</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder={DIARY_KINDS[kind].defaultTitle} autoFocus
            className="border-b border-foreground/30 bg-transparent py-1 text-2xl outline-none placeholder:text-muted/60 focus:border-foreground" />
        </label>
        {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="font-mono text-xs uppercase tracking-wider text-muted hover:text-foreground">отмена</button>
          <button type="submit" disabled={busy} data-magnetic
            className="rounded-full bg-foreground px-6 py-3 font-mono text-sm uppercase tracking-[0.15em] text-background disabled:opacity-50">
            {busy ? 'создаю…' : 'Положить на стол'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
