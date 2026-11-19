'use client';
import { useRef, useState } from 'react';
import { processPhoto, type ProcessedPhoto } from '@/lib/client/imageProcess';

export interface PickedPhoto extends ProcessedPhoto { id: string; name: string }

export function PhotoPicker({ photos, onChange, onBusy }: {
  photos: PickedPhoto[]; onChange: (p: PickedPhoto[]) => void; onBusy: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(0);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = 5 - photos.length;
    const list = [...files].slice(0, room);
    if (files.length > room) setError('Максимум 5 фото — лишние пропущены');
    setBusy((b) => b + list.length); onBusy(true);
    const next = [...photos];
    for (const f of list) {
      try {
        const p = await processPhoto(f, next.length);
        next.push({ ...p, id: crypto.randomUUID(), name: f.name });
        onChange([...next]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не получилось открыть фото');
      } finally {
        setBusy((b) => b - 1);
      }
    }
    onBusy(false);
    if (input.current) input.current.value = '';
  }

  const reindex = (list: PickedPhoto[]) => list.map((p, i) => ({ ...p, features: { ...p.features, index: i } }));
  const remove = (id: string) => onChange(reindex(photos.filter((p) => p.id !== id)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= photos.length) return;
    const list = [...photos];
    [list[i], list[j]] = [list[j], list[i]];
    onChange(reindex(list));
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {photos.map((p, i) => (
          <figure key={p.id} className="group relative aspect-[3/4] overflow-hidden rounded-sm bg-black/5 shadow-sm ring-1 ring-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt={`Фото ${i + 1}`} className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/60 to-transparent p-1.5 font-mono text-xs text-white">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-1 disabled:opacity-30" aria-label="Левее">←</button>
              <button type="button" onClick={() => remove(p.id)} className="px-1" aria-label="Удалить фото">✕</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === photos.length - 1} className="px-1 disabled:opacity-30" aria-label="Правее">→</button>
            </div>
            <div className="absolute left-1.5 top-1.5 flex gap-0.5">
              {p.features.palette.slice(0, 4).map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full ring-1 ring-white/70" style={{ background: c }} />)}
            </div>
          </figure>
        ))}
        {Array.from({ length: busy }).map((_, i) => (
          <div key={`busy-${i}`} className="flex aspect-[3/4] animate-pulse items-center justify-center rounded-sm bg-black/5 font-mono text-xs text-muted">обработка…</div>
        ))}
        {photos.length + busy < 5 && (
          <button type="button" onClick={() => input.current?.click()}
            className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-foreground/30 text-muted transition hover:border-foreground/60 hover:text-foreground">
            <span className="text-3xl leading-none">+</span>
            <span className="font-mono text-[11px] uppercase tracking-wider">фото</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => add(e.target.files)} />
      {error && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
