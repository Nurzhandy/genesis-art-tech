'use client';
// Хранилище мыслей: поле «бросить мысль», цветная мозаика карточек, поиск и фильтр по меткам.
import { useMemo, useState } from 'react';
import { useStored, writeStored } from '@/lib/client/diaryKey';
import { KIND_LOOK, newThought, parseThoughts, searchThoughts, THOUGHTS_KEY, type ThoughtKind } from '@/lib/thoughts';

export function ThoughtsVault() {
  const raw = useStored(THOUGHTS_KEY);
  const list = useMemo(() => parseThoughts(raw), [raw]);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<ThoughtKind | 'all'>('all');
  const shown = searchThoughts(list, q, kind);
  const save = (next: typeof list) => writeStored(THOUGHTS_KEY, JSON.stringify(next));

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    save([newThought(draft), ...list]);
    setDraft('');
  }

  return (
    <div>
      <form onSubmit={add} className="mb-6 flex flex-col gap-3 rounded-2xl border border-foreground/15 bg-background/60 p-4 backdrop-blur sm:flex-row sm:items-end">
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={2000} aria-label="Новая мысль"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(e); }}
          placeholder="Мысль, цитата, ссылка или идея…"
          className="min-h-[3.5rem] flex-1 resize-y bg-transparent text-xl leading-relaxed outline-none placeholder:text-muted/70" />
        <button type="submit" disabled={!draft.trim()} className="rounded-full bg-foreground px-6 py-2.5 text-lg text-background transition hover:opacity-90 disabled:opacity-30">Сохранить</button>
      </form>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти мысль…" aria-label="Поиск по мыслям"
          className="min-w-0 flex-1 basis-48 border-b border-foreground/30 bg-transparent py-1.5 text-lg outline-none placeholder:text-muted/70 focus:border-foreground" />
        {(['all', ...Object.keys(KIND_LOOK)] as (ThoughtKind | 'all')[]).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
            className={`rounded-full border px-3 py-1 text-sm transition ${kind === k ? 'border-foreground bg-foreground text-background' : 'border-foreground/20 text-muted hover:text-foreground'}`}>
            {k === 'all' ? 'всё' : KIND_LOOK[k].label}
          </button>
        ))}
      </div>

      {raw !== undefined && !list.length && <p className="py-12 text-center font-hand text-3xl text-muted">Пока пусто. Первая мысль — самая лёгкая.</p>}
      {list.length > 0 && !shown.length && <p className="py-12 text-center text-lg text-muted">Ничего не нашлось.</p>}

      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {shown.map((t) => {
          const look = KIND_LOOK[t.kind];
          const link = t.kind === 'link' ? (t.text.startsWith('http') ? t.text : `https://${t.text}`) : null;
          return (
            <article key={t.id} className="group relative mb-4 break-inside-avoid rounded-2xl p-5 text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-xl"
              style={{ background: `linear-gradient(150deg, ${look.color}, color-mix(in srgb, ${look.color} 55%, #000))` }}>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wider opacity-75">{look.label} · {new Date(t.at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</p>
              {link
                ? <a href={link} target="_blank" rel="noreferrer" className="break-all text-lg underline underline-offset-4">{t.text}</a>
                : <p className={`whitespace-pre-line leading-snug ${t.kind === 'quote' ? 'font-hand text-2xl' : 'text-xl'}`}>{t.text}</p>}
              <button type="button" onClick={() => save(list.filter((x) => x.id !== t.id))} aria-label="Удалить мысль"
                className="absolute right-3 top-3 rounded-full px-2 text-white/60 opacity-0 transition hover:text-white group-hover:opacity-100 focus:opacity-100">✕</button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
