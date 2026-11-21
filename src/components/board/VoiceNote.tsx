'use client';
// Голосовое на доске, как в WhatsApp (21.11): удерживайте микрофон — идёт запись, отпустили — голосовое на доске.
// Короткое нажатие — запись «с замком»: говорите сколько нужно и нажмите «отправить». Проведите влево — отмена.
// На доске голосовое — пузырь с волной громкости: нажать — играет вашим голосом. Под ним расшифровка — слова дня.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MAX_VOICE_SEC, VOICE_BARS, type BoardItem, type VoiceExt } from '@/lib/board/board';
import { pickRecordingType, recordingExt } from '@/lib/voice/ownVoice';
import { micError, recognitionCtor, type Recognition } from '../StoryRecorder';

export interface Recording { blob: Blob; ext: VoiceExt; sec: number; peaks: number[]; said: string }
type VoiceItem = Extract<BoardItem, { kind: 'voice' }>;

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const HOLD_MS = 350;          // дольше — «удержание»: отпустили и голосовое ушло
const CANCEL_PX = 90;         // столько провести влево, чтобы отменить
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Громкость по ходу записи → ровно VOICE_BARS столбиков (громкий — до 1, тишина — не ниже 0.08). */
export function toPeaks(levels: number[], bars = VOICE_BARS): number[] {
  if (!levels.length) return Array.from({ length: bars }, () => 0.08);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const a = Math.floor((i * levels.length) / bars), b = Math.max(a + 1, Math.floor(((i + 1) * levels.length) / bars));
    out.push(Math.max(...levels.slice(a, b)));
  }
  const top = Math.max(...out) || 1;
  return out.map((v) => Math.round(Math.max(0.08, v / top) * 100) / 100);
}

export function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Не получилось прочитать запись'));
    r.readAsDataURL(blob);
  });
}

/** Голосовое файлом (из WhatsApp, Telegram, диктофона) → такая же запись, как с микрофона. */
export async function voiceFromFile(f: File): Promise<Recording> {
  if (f.size > MAX_FILE_BYTES) throw new Error('Голосовое больше 8 МБ — возьмите покороче (до 3 минут)');
  const ext: VoiceExt = /\.(m4a|mp4|aac)$/i.test(f.name) ? 'm4a' : /\.(ogg|oga|opus)$/i.test(f.name) ? 'ogg'
    : /\.mp3$/i.test(f.name) ? 'mp3' : /\.wav$/i.test(f.name) ? 'wav' : /\.webm$/i.test(f.name) ? 'webm' : recordingExt(f.type);
  const type = f.type.startsWith('audio/') ? f.type : { m4a: 'audio/mp4', mp4: 'audio/mp4', ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', webm: 'audio/webm' }[ext];
  const blob = new Blob([f], { type });
  let sec = 0, levels: number[] = [];
  try {
    const ctx = new AudioContext();
    const buf = await ctx.decodeAudioData(await f.arrayBuffer());
    void ctx.close();
    sec = buf.duration;
    const ch = buf.getChannelData(0), step = Math.max(1, Math.floor(ch.length / 400));
    for (let i = 0; i < ch.length; i += step) {
      let sum = 0;
      for (let j = i; j < Math.min(ch.length, i + step); j += 8) sum += ch[j] * ch[j];
      levels.push(Math.sqrt(sum / (step / 8)));
    }
  } catch {
    // Браузер не разобрал формат (бывает с opus в Safari): длительность возьмём у плеера, волну — ровную.
    sec = await new Promise<number>((resolve) => {
      const a = new Audio(URL.createObjectURL(blob));
      a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : 0);
      a.onerror = () => resolve(0);
    });
    levels = [];
  }
  return { blob, ext, sec: Math.min(600, sec), peaks: toPeaks(levels), said: '' };
}

type State =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'recording'; sec: number; locked: boolean; drag: number }
  | { kind: 'sending' }
  | { kind: 'error'; message: string };

/** Кнопка микрофона для панели доски + плашка записи над панелью. */
export function VoiceMic({ onRecorded, className }: { onRecorded: (r: Recording) => Promise<void>; className: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [bars, setBars] = useState<number[]>([]);
  const [live, setLive] = useState('');
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const levels = useRef<number[]>([]);
  const said = useRef('');
  const started = useRef(0);
  const cleanup = useRef<() => void>(() => undefined);
  const hold = useRef<{ at: number; x: number } | null>(null);
  const lockWhenReady = useRef(false);
  const busy = useRef(false);
  const stateRef = useRef<State>(state);
  // Состояние нужно и в обработчиках указателя сразу после смены — держим копию в ref.
  const put = (s: State) => { stateRef.current = s; setState(s); };

  useEffect(() => () => { cleanup.current(); rec.current?.stop(); }, []);

  async function start() {
    if (busy.current) return;
    busy.current = true;
    lockWhenReady.current = false;
    put({ kind: 'starting' });
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      put({ kind: 'error', message: 'Этот браузер не умеет записывать голос. Перетащите на доску готовое голосовое файлом.' });
      busy.current = false; return;
    }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { put({ kind: 'error', message: micError(e).replace(/ или загрузите голосовое( из телефона)? ниже/, ' или перетащите голосовое файлом прямо на доску') }); busy.current = false; return; }

    chunks.current = []; levels.current = []; said.current = ''; setBars([]); setLive('');
    const type = pickRecordingType((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32_000 } : undefined);
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.start(500);
    rec.current = r;

    // Громкость: для волны на доске и живых столбиков в плашке.
    let raf = 0, ctx: AudioContext | null = null, last = 0;
    try {
      ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const tick = (t: number) => {
        if (t - last > 70) {
          last = t;
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += ((v - 128) / 128) ** 2;
          const level = Math.min(1, Math.sqrt(sum / buf.length) * 4);
          levels.current.push(level);
          setBars((b) => [...b.slice(-35), level]);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch { /* без волны — не страшно */ }

    // Живая расшифровка (Chrome, Edge, Safari): человек видит, что его слышат; она же — запасная расшифровка.
    let recog: Recognition | null = null;
    const Ctor = recognitionCtor();
    if (Ctor) {
      recog = new Ctor();
      recog.lang = 'ru-RU'; recog.continuous = true; recog.interimResults = true;
      let finalText = '';
      recog.onresult = (e) => {
        let pending = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalText += ` ${e.results[i][0].transcript}`; else pending += e.results[i][0].transcript;
        }
        said.current = finalText.trim();
        setLive(`${finalText} ${pending}`.trim());
      };
      recog.onerror = () => undefined;
      recog.onend = () => { if (recog && rec.current === r) { try { recog.start(); } catch { /* уже идёт */ } } };
      try { recog.start(); } catch { recog = null; }
    }

    started.current = Date.now();
    const timer = setInterval(() => {
      const sec = (Date.now() - started.current) / 1000;
      if (sec >= MAX_VOICE_SEC) { void send(); return; }
      { const cur = stateRef.current; if (cur.kind === 'recording') put({ ...cur, sec }); }
    }, 200);
    cleanup.current = () => {
      clearInterval(timer);
      cancelAnimationFrame(raf);
      void ctx?.close().catch(() => undefined);
      const rr = recog; recog = null; try { rr?.stop(); } catch { /* уже */ }
      stream.getTracks().forEach((t) => t.stop());
    };
    // Пока браузер спрашивал разрешение, кнопку уже отпустили — пишем «с замком».
    put({ kind: 'recording', sec: 0, locked: lockWhenReady.current || !hold.current, drag: 0 });
  }

  function stopRecorder(): Promise<Blob | null> {
    const r = rec.current;
    rec.current = null;
    if (!r || r.state === 'inactive') return Promise.resolve(null);
    return new Promise((resolve) => {
      r.onstop = () => resolve(chunks.current.length ? new Blob(chunks.current, { type: r.mimeType || 'audio/webm' }) : null);
      r.stop();
    });
  }

  async function send() {
    if (stateRef.current.kind !== 'recording') return;
    const sec = (Date.now() - started.current) / 1000;
    put({ kind: 'sending' });
    const blob = await stopRecorder();
    cleanup.current(); cleanup.current = () => undefined;
    if (!blob || sec < 0.8) {
      put({ kind: 'error', message: 'Слишком коротко. Удерживайте микрофон и говорите, или нажмите один раз — запись пойдёт без рук.' });
      busy.current = false; return;
    }
    try {
      await onRecorded({ blob, ext: recordingExt(blob.type), sec: Math.min(MAX_VOICE_SEC, sec), peaks: toPeaks(levels.current), said: said.current });
      put({ kind: 'idle' });
    } catch (e) {
      put({ kind: 'error', message: e instanceof Error ? e.message : 'Не получилось отправить голосовое' });
    }
    busy.current = false;
  }

  async function cancel() {
    await stopRecorder();
    cleanup.current(); cleanup.current = () => undefined;
    hold.current = null;
    busy.current = false;
    put({ kind: 'idle' });
  }

  // Как в WhatsApp: удерживать — запись, отпустить — отправить, провести влево — отмена, короткое нажатие — замок.
  function onDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const s = stateRef.current;
    if (s.kind === 'recording') { void send(); return; }
    if (s.kind !== 'idle' && s.kind !== 'error') return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    hold.current = { at: Date.now(), x: e.clientX };
    void start();
  }
  function onMove(e: React.PointerEvent) {
    const h = hold.current, s = stateRef.current;
    if (!h || s.kind !== 'recording' || s.locked) return;
    const drag = Math.min(0, e.clientX - h.x);
    if (drag < -CANCEL_PX) { void cancel(); return; }
    put({ ...s, drag });
  }
  function onUp() {
    const h = hold.current, s = stateRef.current;
    hold.current = null;
    if (!h) return;
    const quick = Date.now() - h.at < HOLD_MS;
    if (s.kind === 'starting') { lockWhenReady.current = true; return; }
    if (s.kind !== 'recording' || s.locked) return;
    if (quick) put({ ...s, locked: true, drag: 0 }); else void send();
  }

  // Escape — отмена записи.
  useEffect(() => {
    if (state.kind !== 'recording') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void cancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const recording = state.kind === 'recording';
  return (
    <>
      <button type="button" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        aria-label={recording ? 'Отправить голосовое' : 'Голосовое: удерживайте или нажмите'} aria-pressed={recording}
        className={`${className} touch-none select-none ${recording ? 'bg-[#00a884] text-white hover:bg-[#00a884]' : ''}`}>
        {recording && !state.locked && <span className="absolute inset-0 animate-ping rounded-full bg-[#00a884]/40" aria-hidden />}
        {recording && state.locked ? <SendGlyph /> : <MicGlyph />}
        {!recording && <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 font-mono text-[10px] text-background opacity-0 transition group-hover:opacity-100">Голосовое — удерживайте</span>}
      </button>

      {/* Плашка — в body: внутри панели доски (backdrop-blur + прокрутка) fixed обрезается панелью. */}
      {state.kind !== 'idle' && createPortal(
        <div className="[--background:#f6f1e8] [--foreground:#2b241c] [--muted:#7a7064] text-[#2b241c] pointer-events-auto fixed bottom-24 left-1/2 z-30 w-[min(92vw,460px)] -translate-x-1/2" style={{ animation: 'pop-in 0.25s ease-out both' }} role="status" aria-live="polite">
          {recording && live && <p className="mb-2 line-clamp-2 rounded-xl bg-background/90 px-4 py-2 font-hand text-xl leading-snug text-muted shadow">{live.slice(-140)}</p>}
          <div className={`flex items-center gap-3 bg-background/95 py-2 pl-3 pr-2 ${state.kind === 'error' ? 'rounded-2xl' : 'rounded-full'} shadow-2xl ring-1 ring-black/5 backdrop-blur`}>
            {state.kind === 'starting' && <p className="flex-1 px-2 font-mono text-[11px] text-muted">включаю микрофон…</p>}
            {state.kind === 'sending' && <p className="flex-1 px-2 font-mono text-[11px] text-muted">кладу голосовое на доску…</p>}
            {state.kind === 'error' && <>
              <p className="flex-1 whitespace-pre-line px-2 text-sm text-red-700">{state.message}</p>
              <button type="button" onClick={() => put({ kind: 'idle' })} className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-foreground/10" aria-label="Закрыть">✕</button>
            </>}
            {recording && <>
              {state.locked
                ? <button type="button" onClick={() => void cancel()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#54656f] hover:bg-foreground/10" aria-label="Удалить запись"><TrashGlyph /></button>
                : <span className="w-9 shrink-0" />}
              <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-600" aria-hidden />
              <span className="w-10 shrink-0 font-mono text-sm tabular-nums">{mmss(state.sec)}</span>
              {state.locked
                ? <span className="flex h-7 flex-1 items-center justify-end gap-[3px] overflow-hidden" aria-hidden>
                    {bars.map((v, i) => <span key={i} className="w-[3px] shrink-0 rounded-full bg-[#54656f]" style={{ height: `${Math.max(12, v * 100)}%` }} />)}
                  </span>
                : <span className="flex-1 truncate text-center font-mono text-[11px] text-muted" style={{ transform: `translateX(${state.drag}px)`, opacity: 1 + state.drag / (CANCEL_PX * 1.4) }}>‹ влево — отмена · отпустите — отправить</span>}
              {state.locked && (
                <button type="button" onClick={() => void send()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#00a884] text-white shadow-md transition hover:scale-105" aria-label="Отправить голосовое"><SendGlyph /></button>
              )}
            </>}
          </div>
        </div>, document.body,
      )}
    </>
  );
}

// Только одно голосовое играет за раз.
let playingNow: HTMLAudioElement | null = null;
const SPEEDS = [1, 1.5, 2] as const;

/** Пузырь голосового на доске. */
export function VoiceBubble({ item, url, transcribing, editable, onTranscript }: {
  item: VoiceItem; url: string | undefined; transcribing: boolean; editable: boolean; onTranscript: (text: string) => void;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [heard, setHeard] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.transcript ?? '');

  useEffect(() => () => { audio.current?.pause(); }, []);

  function player(): HTMLAudioElement | null {
    if (!url) return null;
    if (!audio.current) {
      const a = new Audio(url);
      a.ontimeupdate = () => setPos(a.currentTime);
      a.onpause = () => setPlaying(false);
      a.onplay = () => setPlaying(true);
      a.onended = () => { setPlaying(false); setPos(0); setHeard(true); };
      audio.current = a;
    }
    return audio.current;
  }

  function toggle() {
    const a = player();
    if (!a) return;
    if (!a.paused) { a.pause(); return; }
    if (playingNow && playingNow !== a) playingNow.pause();
    playingNow = a;
    a.playbackRate = speed;
    void a.play().catch(() => setPlaying(false));
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = player();
    if (!a || !item.sec) return;
    const r = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * item.sec;
    try { a.currentTime = t; setPos(t); } catch { /* запись без разметки времени — перемотка не везде */ }
    if (a.paused) toggle();
  }

  function nextSpeed() {
    const s = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(s);
    if (audio.current) audio.current.playbackRate = s;
  }

  const progress = item.sec ? Math.min(1, pos / item.sec) : 0;
  const peaks = item.peaks.length ? item.peaks : Array.from({ length: VOICE_BARS }, () => 0.15);
  const done = Math.round(progress * peaks.length);
  const accent = heard ? '#53bdeb' : '#00a884';

  return (
    <div className="w-full">
      <div className="relative rounded-2xl rounded-tr-[4px] bg-[#d9fdd3] px-3 pb-1.5 pt-2.5 text-[#111b21] shadow-md">
        <span className="absolute -right-[9px] top-0 h-0 w-0 border-l-[10px] border-t-[13px] border-l-transparent border-t-[#d9fdd3]" aria-hidden />
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={toggle} disabled={!url} aria-label={playing ? 'Пауза' : 'Слушать голосовое'}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#54656f] transition hover:bg-black/5 disabled:opacity-40">
            {playing ? <PauseGlyph /> : <PlayGlyph />}
          </button>
          <div onClick={seek} className="relative flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-[2px]" aria-hidden>
            {peaks.map((v, i) => (
              <span key={i} className="min-w-[2px] flex-1 rounded-full" style={{ height: `${Math.max(10, v * 100)}%`, background: i < done ? accent : 'rgba(17,27,33,0.28)' }} />
            ))}
            <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow" style={{ left: `${progress * 100}%`, background: accent }} />
          </div>
          {playing
            ? <button type="button" onClick={nextSpeed} className="grid h-12 w-12 shrink-0 place-items-center" aria-label="Скорость">
                <span className="rounded-full bg-black/40 px-2 py-0.5 font-mono text-xs font-semibold text-white">{String(speed).replace('.', ',')}×</span>
              </button>
            : <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#c8892b] text-white" aria-hidden>
                <MicGlyph />
                <span className="absolute -bottom-0.5 -left-0.5 grid h-5 w-5 place-items-center rounded-full bg-[#d9fdd3]" style={{ color: accent }}><MicGlyph size={13} /></span>
              </span>}
        </div>
        <div className="flex items-center justify-between pl-[3.1rem] pr-1 font-mono text-[11px] text-[#667781]">
          <span>{mmss(playing || pos ? pos : item.sec)}</span>
          <span>голосовое</span>
        </div>
      </div>

      {/* Расшифровка — это и есть «слова дня» для сборки; её можно поправить. */}
      {editing
        ? <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onPointerDown={(e) => e.stopPropagation()}
            onBlur={() => { setEditing(false); if (draft.trim() !== (item.transcript ?? '')) onTranscript(draft.trim()); }}
            rows={Math.max(2, Math.ceil(draft.length / 36))} className="mt-2 w-full resize-none rounded-lg bg-[#fbf8f1] px-3 py-2 font-hand text-xl leading-snug shadow-inner outline-none" />
        : transcribing
          ? <p className="mt-2 px-1 font-mono text-[11px] text-muted"><span className="story-dots mr-2 align-middle" />расшифровываю…</p>
          : item.transcript
            ? <p onDoubleClick={(e) => { if (!editable) return; e.stopPropagation(); setDraft(item.transcript ?? ''); setEditing(true); }}
                className="mt-2 whitespace-pre-wrap px-1 font-hand text-xl leading-snug" title={editable ? 'Двойной щелчок — поправить' : undefined}>«{item.transcript}»</p>
            : editable && <button type="button" onClick={() => { setDraft(''); setEditing(true); }} onPointerDown={(e) => e.stopPropagation()}
                className="mt-2 px-1 font-mono text-[11px] text-muted underline-offset-4 hover:underline">+ написать, о чём голосовое</button>}
    </div>
  );
}

function MicGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}
function SendGlyph() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M3.4 20.4 21 12 3.4 3.6l-.01 6.5L15 12 3.39 13.9z" /></svg>;
}
function PlayGlyph() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4.5v15l12.5-7.5z" /></svg>;
}
function PauseGlyph() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="4.5" width="4" height="15" rx="1" /><rect x="14" y="4.5" width="4" height="15" rx="1" /></svg>;
}
function TrashGlyph() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" /></svg>;
}
