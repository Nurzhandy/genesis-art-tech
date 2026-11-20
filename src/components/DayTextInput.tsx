'use client';
// Поле «как прошёл день»: подсказки-чипы (R6). Голосом день рассказывают через «Рассказать день»
// (StoryRecorder) — он работает во всех браузерах и бережно переписывает рассказ в запись.
// Чем больше конкретных деталей, тем точнее воспоминание: детали попадают в подпись и заметки на полях.
import { useRef } from 'react';

const CHIPS = [
  { label: 'погода', start: 'Погода была ' },
  { label: 'свет', start: 'Свет был ' },
  { label: 'запах', start: 'Пахло ' },
  { label: 'звук', start: 'Было слышно ' },
  { label: 'кто рядом', start: 'Рядом был(а) ' },
  { label: 'мелочь', start: 'Запомнилась мелочь: ' },
];

/** Добавляет фрагмент к тексту с правильным разделителем. */
export function appendPhrase(text: string, phrase: string): string {
  const t = text.replace(/\s+$/, '');
  if (!t) return phrase.charAt(0).toLocaleUpperCase('ru') + phrase.slice(1);
  const sep = /[.!?…]$/.test(t) ? ' ' : /[,;:—-]$/.test(t) ? ' ' : '. ';
  const start = sep === '. ' || /[.!?…]$/.test(t) ? phrase.charAt(0).toLocaleUpperCase('ru') + phrase.slice(1) : phrase;
  return t + sep + start;
}

export function DayTextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const area = useRef<HTMLTextAreaElement>(null);

  function addChip(start: string) {
    const next = appendPhrase(value, start);
    onChange(next);
    requestAnimationFrame(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.length, next.length);
    });
  }

  const used = (start: string) => value.toLocaleLowerCase('ru').includes(start.trim().toLocaleLowerCase('ru'));

  return (
    <div>
      <textarea ref={area} id="text" value={value} onChange={(e) => onChange(e.target.value)} rows={7} maxLength={5000}
        placeholder={placeholder ?? 'Расскажите как другу: погода, свет, запахи, звуки, кто был рядом, мелочи, которые запомнились…'}
        className="w-full resize-y rounded-sm border border-foreground/15 bg-white/40 p-4 text-xl leading-relaxed outline-none placeholder:text-muted/70 focus:border-foreground/40 dark:bg-white/5" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-muted">добавить деталь:</span>
        {CHIPS.map((c) => (
          <button key={c.label} type="button" onClick={() => addChip(c.start)}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] transition ${used(c.start) ? 'border-foreground/50 text-foreground' : 'border-foreground/20 text-muted hover:border-foreground/50 hover:text-foreground'}`}>
            {used(c.start) ? '✓ ' : '+ '}{c.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-[11px] text-muted">{value.length}/5000</span>
      </div>
    </div>
  );
}
