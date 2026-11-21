'use client';
// «Рассказать день»: нет времени писать — человек пару минут рассказывает голосом, как другу,
// а система бережно переписывает рассказ в запись дневника (его словами, без выдумок).
// Запись голоса можно оставить в папке дня: через год день расскажет сам — вашим голосом.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { api } from '@/lib/client/api';
import { cleanTranscript } from '@/lib/ai/cleanTranscript';
import { pickRecordingType, recordingExt, type RecordingExt } from '@/lib/voice/ownVoice';

export const MAX_STORY_SEC = 180;

export interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;
export const recognitionCtor = (): RecognitionCtor | null => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
/** Понятная причина, почему микрофон не включился, и что сделать. */
export function micError(e: unknown): string {
  const name = (e as { name?: string })?.name ?? '';
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'Микрофон работает только на защищённом адресе (https или localhost). Откройте сайт по https.';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Браузер запретил микрофон для этой страницы.\nНажмите на значок замка или камеры слева от адреса → «Микрофон: разрешить» и нажмите кнопку ещё раз. Во встроенном браузере приложения микрофона может не быть — откройте сайт в Chrome, Edge или Safari, или загрузите голосовое ниже.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Микрофон не найден. Подключите наушники с микрофоном или загрузите голосовое из телефона ниже.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'Микрофон занят другой программой (Zoom, Discord, Teams). Закройте её и нажмите ещё раз.';
  return 'Не получилось включить микрофон. Попробуйте ещё раз или загрузите голосовое ниже.';
}

const canRecord = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
const noop = () => () => undefined;

export interface StoryOutcome {
  entry: string;
  place: string | null;
  songUrl: string | null;
  song: string | null;
  voice: { blob: Blob; ext: RecordingExt } | null;
}

type State =
  | { kind: 'idle' }
  | { kind: 'recording'; sec: number }
  | { kind: 'thinking' }
  | { kind: 'review'; entry: string; said: string; details: string[]; place: string | null; song: string | null; songUrl: string | null; source: 'ai' | 'local' }
  | { kind: 'error'; message: string };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Не получилось прочитать запись'));
    r.readAsDataURL(blob);
  });
}

export function StoryRecorder({ onUse, hasText, highlight = false }: { onUse: (o: StoryOutcome) => void; hasText: boolean; highlight?: boolean }) {
  // Два варианта записи: «переписать красиво» (AI) или «оставить как сказал» (только без слов-паразитов).
  const [version, setVersion] = useState<'polished' | 'said'>('polished');
  const supported = useSyncExternalStore(noop, () => canRecord() || recognitionCtor() !== null, () => true);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [live, setLive] = useState('');
  const [keepVoice, setKeepVoice] = useState(true);
  const ring = useRef<HTMLSpanElement>(null);
  const media = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recog = useRef<Recognition | null>(null);
  const transcript = useRef('');
  const voice = useRef<{ blob: Blob; ext: RecordingExt } | null>(null);
  const cleanup = useRef<() => void>(() => undefined);
  const cancelled = useRef(false);
  const finishing = useRef(false);

  useEffect(() => () => cleanup.current(), []);

  async function start() {
    cancelled.current = false;
    finishing.current = false;
    transcript.current = '';
    voice.current = null;
    chunks.current = [];
    setLive('');
    let stream: MediaStream | null = null;
    if (canRecord()) {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch (e) { setState({ kind: 'error', message: micError(e) }); return; }
    }

    // 1. Сама запись — её услышит модель и её можно оставить в папке дня.
    let raf = 0;
    let ctx: AudioContext | null = null;
    if (stream) {
      const type = pickRecordingType((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32_000 } : undefined);
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.start(1000);
      media.current = rec;
      // 2. Кольцо дышит громкостью голоса: пишем прямо в стиль, без перерисовки React.
      try {
        ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += ((v - 128) / 128) ** 2;
          const level = Math.min(1, Math.sqrt(sum / buf.length) * 4);
          if (ring.current) ring.current.style.transform = `scale(${1 + level * 0.55})`;
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch { /* без кольца — не страшно */ }
    }

    // 3. Живая расшифровка, если браузер умеет (Chrome, Edge, Safari): человек видит, что его слышат.
    const Ctor = recognitionCtor();
    if (Ctor) {
      const r = new Ctor();
      r.lang = 'ru-RU'; r.continuous = true; r.interimResults = true;
      let finalText = '';
      r.onresult = (e) => {
        let pending = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalText += ` ${e.results[i][0].transcript}`; else pending += e.results[i][0].transcript;
        }
        transcript.current = finalText.trim();
        setLive(`${finalText} ${pending}`.trim());
      };
      r.onerror = () => undefined;
      // Распознавание само замолкает на паузах — перезапускаем, пока идёт запись.
      r.onend = () => { if (recog.current === r && !cancelled.current) { try { r.start(); } catch { /* уже идёт */ } } };
      recog.current = r;
      try { r.start(); } catch { recog.current = null; }
    }
    if (!stream && !recog.current) { setState({ kind: 'error', message: 'Этот браузер не умеет записывать голос. Напишите день текстом ниже.' }); return; }

    const started = Date.now();
    const timer = setInterval(() => {
      const sec = (Date.now() - started) / 1000;
      if (sec >= MAX_STORY_SEC) void finish();
      else setState({ kind: 'recording', sec });
    }, 250);
    setState({ kind: 'recording', sec: 0 });

    cleanup.current = () => {
      clearInterval(timer);
      cancelAnimationFrame(raf);
      void ctx?.close().catch(() => undefined);
      const r = recog.current; recog.current = null; try { r?.stop(); } catch { /* уже */ }
      stream?.getTracks().forEach((t) => t.stop());
    };
  }

  function stopRecorder(): Promise<Blob | null> {
    const rec = media.current;
    media.current = null;
    if (!rec || rec.state === 'inactive') return Promise.resolve(null);
    return new Promise((resolve) => {
      rec.onstop = () => resolve(chunks.current.length ? new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' }) : null);
      rec.stop();
    });
  }

  async function finish() {
    // Таймер на 3:00 и кнопка могут сработать одновременно — разбираем рассказ один раз.
    if (finishing.current) return;
    finishing.current = true;
    const blob = await stopRecorder();
    cleanup.current();
    cleanup.current = () => undefined;
    await process(blob, transcript.current);
  }

  /** Запись голоса (с микрофона или файлом) → запись дневника. */
  async function process(blob: Blob | null, said: string) {
    setState({ kind: 'thinking' });
    if (blob) voice.current = { blob, ext: recordingExt(blob.type) };
    try {
      const r = await api.story({
        ...(blob ? { audio: await toBase64(blob), mime: blob.type || 'audio/webm' } : {}),
        ...(said ? { transcript: said } : {}),
      });
      setState({ kind: 'review', entry: r.entry, said: cleanTranscript(r.transcript) || r.entry, details: r.details, place: r.place, song: r.song, songUrl: r.songUrl, source: r.source });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Не получилось разобрать рассказ' });
    }
  }

  // Без микрофона: голосовое из телефона, WhatsApp или Telegram — так же становится записью дня.
  async function pickVoiceFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setState({ kind: 'error', message: 'Файл больше 8 МБ — возьмите голосовое покороче (до ~3 минут).' }); return; }
    transcript.current = '';
    voice.current = null;
    // Тип по расширению, если браузер не знает (или считает голосовое «видео»): сервер принимает только audio/*.
    const byExt = /\.(m4a|mp4|aac)$/i.test(f.name) ? 'audio/mp4' : /\.(ogg|oga|opus)$/i.test(f.name) ? 'audio/ogg'
      : /\.mp3$/i.test(f.name) ? 'audio/mpeg' : /\.wav$/i.test(f.name) ? 'audio/wav' : 'audio/webm';
    const type = f.type.startsWith('audio/') ? f.type : byExt;
    await process(new Blob([f], { type }), '');
  }

  async function cancel() {
    cancelled.current = true;
    await stopRecorder();
    cleanup.current();
    cleanup.current = () => undefined;
    setState({ kind: 'idle' });
  }

  if (!supported) return null;

  if (state.kind === 'review') {
    const text = version === 'said' ? state.said : state.entry;
    return (
      <section className="story-sheet rounded-md border border-foreground/15 p-5 sm:p-7" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-base text-muted">Так ваш рассказ ляжет в дневник. Поправить можно и потом.</p>
          <div role="radiogroup" aria-label="Вариант записи" className="inline-flex rounded-full border border-foreground/20 p-0.5 text-base">
            {([['polished', 'Перефразировать'], ['said', 'Как я сказал']] as const).map(([v, label]) => (
              <button key={v} type="button" role="radio" aria-checked={version === v} onClick={() => setVersion(v)}
                className={`rounded-full px-3.5 py-1 transition ${version === v ? 'bg-foreground text-background' : 'text-muted hover:text-foreground'}`}>{label}</button>
            ))}
          </div>
        </div>
        <p className="mt-4 whitespace-pre-line text-[1.35rem] leading-[1.6]">{text}</p>
        {state.details.length > 0 && (
          <p className="mt-4 font-hand text-2xl text-muted">запомнилось: {state.details.join(', ')}</p>
        )}
        {(state.place || state.song) && (
          <p className="mt-3 text-sm text-muted">
            {state.place && <>Город: {state.place}. </>}
            {state.song && <>Песня: {state.song}{state.songUrl ? '' : ' (ссылку добавьте сами)'}.</>}
            {' '}Подставим их в форму.
          </p>
        )}
        {state.source === 'local' && <p className="mt-3 text-sm text-muted">AI сейчас недоступен — мы только убрали лишние слова из расшифровки.</p>}
        {voice.current && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-base">
            <input type="checkbox" checked={keepVoice} onChange={(e) => setKeepVoice(e.target.checked)} className="mt-1.5 h-4 w-4 accent-current" />
            <span>Сохранить мою запись в папку дня. <span className="text-muted">Через год этот день расскажет его же голос.</span></span>
          </label>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => {
            onUse({ entry: text, place: state.place, song: state.song, songUrl: state.songUrl, voice: keepVoice ? voice.current : null });
            setState({ kind: 'idle' });
          }} className="rounded-full bg-foreground px-6 py-2.5 text-lg text-background transition hover:opacity-90">
            {hasText ? 'Добавить к записи' : 'Взять в запись'}
          </button>
          <button type="button" onClick={() => setState({ kind: 'idle' })} className="text-base text-muted underline-offset-4 hover:text-foreground hover:underline">
            Рассказать заново
          </button>
        </div>
      </section>
    );
  }

  const recording = state.kind === 'recording';
  const thinking = state.kind === 'thinking';
  return (
    <section id="story" className={`story-card relative overflow-hidden rounded-md border px-4 py-4 transition-colors sm:px-5 ${recording ? 'border-foreground/40' : highlight ? 'story-highlight border-[color:var(--story-ink)]/50' : 'border-foreground/15'}`}>
      <div className="flex items-center gap-4">
        <button type="button" onClick={recording ? () => void finish() : () => void start()} disabled={thinking}
          aria-label={recording ? 'Закончить рассказ' : 'Начать рассказ о дне'}
          className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full disabled:opacity-60">
          <span ref={ring} aria-hidden className={`absolute inset-0 rounded-full transition-transform duration-100 ${recording ? 'bg-[color:var(--story-ink)]/25' : 'bg-foreground/5'}`} />
          <span aria-hidden className={`relative grid h-12 w-12 place-items-center rounded-full ${recording ? 'bg-[color:var(--story-ink)]' : 'bg-foreground'} text-background`}>
            {recording ? <span className="h-3.5 w-3.5 rounded-[3px] bg-background" /> : thinking ? <span className="story-dots" /> : <MicGlyph />}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-2xl leading-tight">
            {recording ? `Слушаю · ${mmss(state.sec)}` : thinking ? 'Переписываю рассказ в дневник…' : 'Рассказать день'}
          </p>
          <p className="text-base text-muted">
            {recording ? `Говорите как другу. Нажмите ещё раз, когда закончите (до ${mmss(MAX_STORY_SEC)}).`
              : thinking ? 'Слушаю запись и убираю лишнее — ваши слова останутся вашими.'
              : 'Нет сил писать? Расскажите пару минут голосом — запись соберётся из ваших слов.'}
          </p>
        </div>
        {recording && (
          <button type="button" onClick={() => void cancel()} className="shrink-0 text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">отменить</button>
        )}
      </div>
      {recording && live && <p className="story-live mt-3 font-hand text-2xl leading-snug text-muted">{live.slice(-160)}</p>}
      {recording && (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[color:var(--story-ink)]" style={{ transform: `scaleX(${state.sec / MAX_STORY_SEC})` }} />
      )}
      {state.kind === 'error' && <p className="mt-3 whitespace-pre-line text-sm text-red-700 dark:text-red-400">{state.message}</p>}
      {!recording && !thinking && (
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
          <input type="file" accept="audio/*,.m4a,.mp3,.ogg,.oga,.opus,.webm,.wav" className="sr-only" onChange={(e) => { void pickVoiceFile(e.target.files?.[0]); e.target.value = ''; }} />
          Нет микрофона? Загрузите голосовое из телефона, WhatsApp или Telegram
        </label>
      )}
    </section>
  );
}

function MicGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}
