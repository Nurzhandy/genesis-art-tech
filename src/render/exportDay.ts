'use client';
// Экспорт воспоминания (план 20.11, C1, C2): обои на телефон и видео 15/30/60 с.
// Рисуем на отдельном холсте 1080×1920 тем же движком, что и плеер, поэтому кадры совпадают.
import type { DayRecord } from '@/lib/types';
import { createEngine, type Engine } from './engine';
import type { DayInfo } from './types';

export function dayInfo(day: DayRecord, songLabel: string): DayInfo {
  return { title: day.title ?? '', caption: day.analysis?.caption ?? '', date: day.date, dayNumber: day.dayNumber, songLabel, notes: day.analysis?.sensory, decor: day.decor };
}

async function exportEngine(day: DayRecord, songLabel: string, noText: boolean): Promise<Engine> {
  if (!day.style) throw new Error('День ещё не собран');
  const photos = day.photos.map((p) => p.url ?? p.thumbUrl ?? '').filter(Boolean);
  return createEngine(document.createElement('canvas'), { style: day.style, photoUrls: photos, info: dayInfo(day, songLabel), noText, fullRes: true });
}

/** Имя файла: «2026-10-18 Осенний парк и какао — обои.jpg». Слэши и кавычки из названия убираем. */
export function exportName(day: Pick<DayRecord, 'date' | 'title'>, suffix: string, ext: string): string {
  const title = (day.title ?? 'день').replace(/[\\/:*?"<>|«»]+/g, ' ').replace(/\s+/g, ' ').trim();
  return `${day.date} ${title} — ${suffix}.${ext}`;
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** Обои: постерный кадр, с текстом дневника или без него. */
export async function renderWallpaper(day: DayRecord, songLabel: string, noText: boolean): Promise<Blob> {
  const engine = await exportEngine(day, songLabel, noText);
  try {
    engine.renderAt(engine.interval * 0.4);
    return await new Promise<Blob>((res, rej) => engine.canvas.toBlob((b) => (b ? res(b) : rej(new Error('Не удалось сохранить обои'))), 'image/jpeg', 0.92));
  } finally { engine.destroy(); }
}

/** Первый формат, который умеет браузер: MP4 удобнее для галереи телефона, WebM — запасной. */
export const VIDEO_TYPES = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
export function pickVideoType(isSupported: (t: string) => boolean): { mime: string; ext: 'mp4' | 'webm' } | null {
  const mime = VIDEO_TYPES.find((t) => isSupported(t));
  return mime ? { mime, ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm' } : null;
}

export const canRecordVideo = () =>
  typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;

/** Звуковая дорожка видео: песня дня и, если есть, озвучка записи поверх неё. */
interface Soundtrack { stream: MediaStream; start(): void; stop(): void; hasMusic: boolean; hasVoice: boolean }

const VOICE_AT = 2.5;      // озвучка вступает на 2,5 с
const MUSIC_UNDER_VOICE = 0.28;

/** Ждём, пока аудио сможет играть (или ошибку/таймаут — тогда без него). */
function ready(el: HTMLAudioElement, ms = 15_000): Promise<boolean> {
  return new Promise((res) => {
    if (el.readyState >= 3) return res(true);
    const t = setTimeout(() => res(false), ms);
    el.addEventListener('canplay', () => { clearTimeout(t); res(true); }, { once: true });
    el.addEventListener('error', () => { clearTimeout(t); res(false); }, { once: true });
  });
}

/**
 * Готовим звук сразу по нажатию кнопки: после долгой подготовки кадров браузер считает, что нажатия уже не было,
 * и молча не даёт включить звук. В колонки ничего не идёт — только в запись.
 */
function prepareSoundtrack(day: DayRecord, seconds: number): Soundtrack {
  const actx = new AudioContext();
  void actx.resume();
  const dest = actx.createMediaStreamDestination();
  const make = (src: string) => {
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.src = src;
    const gain = actx.createGain();
    gain.gain.value = 0;
    actx.createMediaElementSource(el).connect(gain).connect(dest);
    return { el, gain };
  };
  const music = day.songUrl ? make(day.songUrl) : null;
  if (music) music.el.loop = true;
  const voice = day.voice?.url ? make(day.voice.url) : null;
  const track = { stream: dest.stream, hasMusic: !!music, hasVoice: !!voice } as Soundtrack;
  const timers: ReturnType<typeof setTimeout>[] = [];

  track.start = () => {
    void actx.resume();
    const t0 = actx.currentTime;
    if (music) {
      music.el.currentTime = 0;
      void music.el.play().catch(() => undefined);
      const g = music.gain.gain;
      // Музыка нарастает за 1,5 с и стихает к концу ролика.
      g.setValueAtTime(0, t0);
      g.linearRampToValueAtTime(1, t0 + 1.5);
      g.setValueAtTime(1, t0 + Math.max(1.6, seconds - 2));
      g.linearRampToValueAtTime(0, t0 + seconds - 0.2);
    }
    if (voice) {
      voice.gain.gain.value = 1;
      timers.push(setTimeout(() => {
        void voice.el.play().catch(() => undefined);
        // Пока звучит голос, музыка тише; голос закончился — музыка возвращается.
        if (music) {
          const g = music.gain.gain, now = actx.currentTime;
          g.cancelScheduledValues(now);
          g.setValueAtTime(g.value, now);
          g.linearRampToValueAtTime(MUSIC_UNDER_VOICE, now + 0.6);
          voice.el.onended = () => {
            const n = actx.currentTime;
            const fadeAt = t0 + seconds - 2;
            g.cancelScheduledValues(n);
            g.setValueAtTime(g.value, n);
            if (n < fadeAt - 1) { g.linearRampToValueAtTime(1, n + 1.2); g.setValueAtTime(1, fadeAt); }
            g.linearRampToValueAtTime(0, t0 + seconds - 0.2);
          };
          // Ролик кончается раньше голоса — музыка всё равно стихает к концу.
          g.setValueAtTime(MUSIC_UNDER_VOICE, Math.max(now + 0.7, t0 + seconds - 2));
          g.linearRampToValueAtTime(0, t0 + seconds - 0.2);
          voice.gain.gain.setValueAtTime(1, Math.max(now, t0 + seconds - 1.2));
          voice.gain.gain.linearRampToValueAtTime(0, t0 + seconds - 0.2);
        }
      }, VOICE_AT * 1000));
    }
  };
  track.stop = () => {
    timers.forEach(clearTimeout);
    music?.el.pause(); voice?.el.pause();
    void actx.close();
  };
  // Загрузку начинаем сразу, пока готовятся кадры.
  (track as Soundtrack & { loading: Promise<[boolean, boolean]> }).loading = Promise.all([
    music ? ready(music.el) : Promise.resolve(false),
    voice ? ready(voice.el) : Promise.resolve(false),
  ]);
  return track;
}

/** Битрейт видео 1080×1920: зерно, мазки и частицы плохо сжимаются — при 4 Мбит/с картинка «мылится». */
export const VIDEO_BITRATE = 14_000_000;

/**
 * Видео дня: холст в реальном времени (30 кадров/с), песня дня с плавным началом и концом
 * и озвучка записи поверх музыки (музыка под голосом стихает). Песни-ссылки Spotify/YouTube без превью
 * играют только в плеере сервиса — их звука в видео нет.
 */
export async function recordVideo(day: DayRecord, songLabel: string, seconds: number, onProgress: (p: number) => void, signal?: AbortSignal): Promise<{ blob: Blob; ext: string; withSound: boolean; withVoice: boolean }> {
  const type = pickVideoType((t) => MediaRecorder.isTypeSupported(t));
  if (!type || !canRecordVideo()) throw new Error('Этот браузер не умеет записывать видео — попробуйте Chrome или Safari');
  // Звук — до любого ожидания, пока действует нажатие на кнопку.
  const sound = day.songUrl || day.voice?.url ? prepareSoundtrack(day, seconds) : null;
  let engine: Engine | null = null;
  try {
    engine = await exportEngine(day, songLabel, false);
    const loaded = sound ? await (sound as Soundtrack & { loading: Promise<[boolean, boolean]> }).loading : [false, false];
    const stream = engine.canvas.captureStream(30);
    if (sound && (loaded[0] || loaded[1])) sound.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

    const rec = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: VIDEO_BITRATE, audioBitsPerSecond: 192_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<void>((res) => { rec.onstop = () => res(); });

    engine.play(0);
    rec.start(1000);
    if (sound && (loaded[0] || loaded[1])) sound.start();
    const started = performance.now();
    await new Promise<void>((res, rej) => {
      const tick = setInterval(() => {
        const p = (performance.now() - started) / 1000 / seconds;
        onProgress(Math.min(1, p));
        if (signal?.aborted) { clearInterval(tick); rej(new DOMException('Запись остановлена', 'AbortError')); }
        else if (p >= 1) { clearInterval(tick); res(); }
      }, 200);
    }).finally(() => {
      rec.stop();
      stream.getTracks().forEach((t) => t.stop());
    });
    await done;
    return { blob: new Blob(chunks, { type: type.mime.split(';')[0] }), ext: type.ext, withSound: loaded[0], withVoice: loaded[1] };
  } finally {
    engine?.destroy();
    sound?.stop();
  }
}
