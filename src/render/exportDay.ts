'use client';
// Экспорт воспоминания (план 20.11, C1, C2): обои на телефон и видео 15/30/60 с.
// Рисуем на отдельном холсте 1080×1920 тем же движком, что и плеер, поэтому кадры совпадают.
import type { DayRecord } from '@/lib/types';
import { createEngine, type Engine } from './engine';
import type { DayInfo } from './types';

export function dayInfo(day: DayRecord, songLabel: string): DayInfo {
  return { title: day.title ?? '', caption: day.analysis?.caption ?? '', date: day.date, dayNumber: day.dayNumber, songLabel, notes: day.analysis?.sensory };
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

/**
 * Видео дня: холст в реальном времени (30 кадров/с) и звук песни, если он идёт через наш <audio>
 * (свой файл или превью Deezer). У песен-ссылок Spotify/YouTube звука в видео нет — это их плеер.
 */
export async function recordVideo(day: DayRecord, songLabel: string, seconds: number, onProgress: (p: number) => void, signal?: AbortSignal): Promise<{ blob: Blob; ext: string; withSound: boolean }> {
  const type = pickVideoType((t) => MediaRecorder.isTypeSupported(t));
  if (!type || !canRecordVideo()) throw new Error('Этот браузер не умеет записывать видео — попробуйте Chrome или Safari');
  const engine = await exportEngine(day, songLabel, false);
  const stream = engine.canvas.captureStream(30);

  let audio: HTMLAudioElement | null = null;
  let actx: AudioContext | null = null;
  if (day.songUrl) {
    try {
      audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = day.songUrl;
      audio.loop = true;
      actx = new AudioContext();
      const dest = actx.createMediaStreamDestination();
      actx.createMediaElementSource(audio).connect(dest);   // в колонки не идёт: запись тихая для человека
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      await audio.play();
    } catch {
      audio?.pause(); audio = null;
    }
  }

  const rec = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<void>((res) => { rec.onstop = () => res(); });

  rec.start(1000);
  engine.play(0);
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
    engine.destroy();
    audio?.pause();
    void actx?.close();
    stream.getTracks().forEach((t) => t.stop());
  });
  await done;
  return { blob: new Blob(chunks, { type: type.mime.split(';')[0] }), ext: type.ext, withSound: !!audio };
}
