'use client';
// Поле «как прошёл день»: подсказки-чипы (R6) и диктовка голосом (R13).
// Чем больше конкретных деталей, тем точнее воспоминание: детали попадают в подпись и заметки на полях.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

const noop = () => () => undefined;

const CHIPS = [
  { label: 'погода', start: 'Погода была ' },
  { label: 'свет', start: 'Свет был ' },
  { label: 'запах', start: 'Пахло ' },
  { label: 'звук', start: 'Было слышно ' },
  { label: 'кто рядом', start: 'Рядом был(а) ' },
  { label: 'мелочь', start: 'Запомнилась мелочь: ' },
];

interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

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
  const rec = useRef<Recognition | null>(null);
  const latest = useRef(value);
  useEffect(() => { latest.current = value; }, [value]);
  // На сервере window нет: до гидрации кнопки диктовки нет, разметка совпадает.
  const canDictate = useSyncExternalStore(noop, () => recognitionCtor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [micError, setMicError] = useState<string | null>(null);

  useEffect(() => () => rec.current?.stop(), []);

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

  function toggleDictation() {
    if (listening) { rec.current?.stop(); return; }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = 'ru-RU';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let finalText = '';
      let pending = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript; else pending += res[0].transcript;
      }
      if (finalText.trim()) {
        const t = latest.current.replace(/\s+$/, '');
        const next = t ? `${t} ${finalText.trim()}` : finalText.trim().charAt(0).toLocaleUpperCase('ru') + finalText.trim().slice(1);
        latest.current = next;
        onChange(next);
      }
      setInterim(pending);
    };
    r.onerror = (e) => setMicError(e.error === 'not-allowed' ? 'Нет доступа к микрофону — разрешите его в браузере' : 'Диктовка прервалась');
    r.onend = () => { setListening(false); setInterim(''); };
    rec.current = r;
    setMicError(null);
    try { r.start(); setListening(true); } catch { setMicError('Не получилось включить микрофон'); }
  }

  const used = (start: string) => value.toLocaleLowerCase('ru').includes(start.trim().toLocaleLowerCase('ru'));

  return (
    <div>
      {canDictate && (
        // Быстрый путь (спека 2026-11-20): нет времени писать — наговорите день, остальное система соберёт сама.
        <button type="button" onClick={toggleDictation} aria-pressed={listening} data-ink
          className={`mb-3 flex w-full items-center gap-4 rounded-md border px-4 py-3 text-left transition ${listening ? 'border-red-500/60 bg-red-500/10' : 'border-foreground/20 hover:border-foreground/50'}`}>
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl ${listening ? 'animate-pulse bg-red-500 text-white' : 'bg-foreground text-background'}`}>🎙</span>
          <span className="flex flex-col">
            <span className="text-xl leading-tight">{listening ? 'Слушаю… нажмите, чтобы закончить' : 'Наговорить день'}</span>
            <span className="text-sm text-muted">{listening ? 'Рассказывайте как другу: где были, что видели, что звучало' : 'Нет времени писать? Расскажите голосом — страница соберётся сама, со стикерами'}</span>
          </span>
        </button>
      )}
      <div className="relative">
        <textarea ref={area} id="text" value={value} onChange={(e) => onChange(e.target.value)} rows={7} maxLength={5000}
          placeholder={placeholder ?? "Расскажите как другу: погода, свет, запахи, звуки, кто был рядом, мелочи, которые запомнились…"}
          className="w-full resize-y rounded-sm border border-foreground/15 bg-white/40 p-4 text-xl leading-relaxed outline-none placeholder:text-muted/70 focus:border-foreground/40 dark:bg-white/5" />
      </div>
      {interim && <p className="mt-1 text-lg italic text-muted">{interim}…</p>}
      {micError && <p className="mt-1 text-sm text-red-700 dark:text-red-400">{micError}</p>}
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
