'use client';
// Фильм по теме: все фото дней одной темы в одно вертикальное видео 720×1280.
// Титр темы → кадры (наезд камеры, мягкая смена, подпись дня в его цветах) → финал с датами. Звук — песня дня.
import { FADE_SEC, montagePlan, type Theme } from '@/lib/themes';
import { humanDate } from '@/lib/archive';
import { canRecordVideo, pickVideoType } from './exportDay';
import { loadFonts, loadImage } from './engine';
import { kenBurns } from './photoFirst';
import { rgba } from './draw';
import type { RenderPhoto } from './types';

const W = 720, H = 1280;

function cover(g: CanvasRenderingContext2D, p: RenderPhoto, kb: { z: number; dx: number; dy: number }) {
  const k = Math.max(W / p.w, H / p.h) * kb.z;
  const sw = W / k, sh = H / k;
  const sx = Math.min(p.w - sw, Math.max(0, (p.w - sw) / 2 + kb.dx * p.w));
  const sy = Math.min(p.h - sh, Math.max(0, (p.h - sh) / 2 + kb.dy * p.h));
  g.drawImage(p.img, sx, sy, sw, sh, 0, 0, W, H);
}

export async function recordMontage(theme: Theme, onProgress: (p: number) => void, signal?: AbortSignal): Promise<{ blob: Blob; ext: string; withSound: boolean }> {
  const type = pickVideoType((t) => MediaRecorder.isTypeSupported(t));
  if (!type || !canRecordVideo()) throw new Error('Этот браузер не умеет записывать видео — попробуйте Chrome или Safari');
  const { shots, duration } = montagePlan(theme);
  if (!shots.length) throw new Error('В этой теме нет фото');
  const fonts = await loadFonts();
  const images = new Map<string, RenderPhoto>();
  await Promise.all(shots.map(async (s) => {
    const key = `${s.day}:${s.photo}`;
    const ph = theme.days[s.day].photos[s.photo];
    const url = ph.url ?? ph.thumbUrl;
    if (url && !images.has(key)) images.set(key, await loadImage(url).catch(() => null as unknown as RenderPhoto));
  }));

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d')!;
  const colors = theme.colors.length ? theme.colors : ['#7a6a55'];

  function drawTitle(alpha: number) {
    const gr = g.createLinearGradient(0, 0, W, H);
    colors.slice(0, 4).forEach((c, i, a) => gr.addColorStop(a.length > 1 ? i / (a.length - 1) : 0, c));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, W, H);
    g.globalAlpha = alpha;
    g.fillStyle = '#fff'; g.textAlign = 'center';
    g.font = `600 92px ${fonts.serif}`;
    g.fillText(theme.title, W / 2, H * 0.46);
    g.font = `500 40px ${fonts.hand}`;
    g.fillText(theme.why, W / 2, H * 0.46 + 70, W - 80);
    g.font = `500 22px ${fonts.mono}`;
    g.fillText(`${theme.days.length} дн. · ${humanDate(theme.days[0].date)} — ${humanDate(theme.days.at(-1)!.date)}`, W / 2, H * 0.46 + 130, W - 80);
    g.globalAlpha = 1;
  }

  function drawShot(i: number, t: number, alpha: number) {
    const s = shots[i];
    const img = images.get(`${s.day}:${s.photo}`);
    const d = theme.days[s.day];
    const local = Math.min(1, Math.max(0, (t - s.start) / (s.end - s.start)));
    g.save();
    g.globalAlpha = alpha;
    if (img) { g.filter = 'saturate(1.08) contrast(1.03)'; cover(g, img, kenBurns(i, local, d.style?.seed ?? i)); g.filter = 'none'; }
    // Оттенок дня и подпись внизу — в цветах его палитры.
    const accent = d.style?.palette.accents[0] ?? '#ffffff';
    g.globalCompositeOperation = 'soft-light'; g.fillStyle = rgba(accent, 0.25); g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    const shade = g.createLinearGradient(0, H * 0.62, 0, H);
    shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.65)');
    g.fillStyle = shade; g.fillRect(0, H * 0.62, W, H * 0.38);
    g.fillStyle = '#fff'; g.textAlign = 'left';
    g.font = `500 22px ${fonts.mono}`;
    g.fillText(humanDate(d.date), 48, H - 150);
    g.font = `600 52px ${fonts.serif}`;
    g.fillText(d.title ?? '', 48, H - 92, W - 96);
    if (d.analysis?.caption) { g.font = `500 34px ${fonts.hand}`; g.fillText(d.analysis.caption, 48, H - 46, W - 96); }
    g.restore();
  }

  function drawEnd(alpha: number) {
    drawTitle(0);
    g.globalAlpha = alpha;
    g.fillStyle = '#fff'; g.textAlign = 'center';
    g.font = `500 54px ${fonts.hand}`;
    g.fillText('и это тоже было', W / 2, H * 0.48);
    g.font = `500 22px ${fonts.mono}`;
    g.fillText('ДНЕВНИК АТМОСФЕРЫ', W / 2, H * 0.48 + 60);
    g.globalAlpha = 1;
  }

  function frame(t: number) {
    g.clearRect(0, 0, W, H);
    if (t < shots[0].start) { drawTitle(Math.min(1, t / 0.8)); return; }
    const last = shots.at(-1)!;
    if (t >= last.end) { drawShot(shots.length - 1, last.end, 1); drawEnd(Math.min(1, (t - last.end) / 0.8)); return; }
    const i = shots.findIndex((s) => t >= s.start && t < s.end);
    const fadeIn = (t - shots[i].start) / FADE_SEC;
    if (i === 0 && fadeIn < 1) drawTitle(1);
    else if (fadeIn < 1) drawShot(i - 1, t, 1);
    drawShot(i, t, Math.min(1, fadeIn));
  }

  // Звук: песня первого дня, у которого она играет через наш плеер (свой файл или превью Deezer).
  const stream = canvas.captureStream(30);
  let audio: HTMLAudioElement | null = null, actx: AudioContext | null = null;
  const songUrl = theme.days.find((d) => d.songUrl)?.songUrl;
  if (songUrl) {
    try {
      audio = new Audio(); audio.crossOrigin = 'anonymous'; audio.src = songUrl; audio.loop = true;
      actx = new AudioContext();
      const dest = actx.createMediaStreamDestination();
      actx.createMediaElementSource(audio).connect(dest);
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
      await audio.play();
    } catch { audio?.pause(); audio = null; }
  }

  const rec = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: 3_500_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<void>((res) => { rec.onstop = () => res(); });
  rec.start(1000);
  const started = performance.now();
  await new Promise<void>((res, rej) => {
    // setInterval, а не rAF: запись не должна вставать, если вкладку свернули.
    const tick = setInterval(() => {
      const t = (performance.now() - started) / 1000;
      frame(Math.min(t, duration));
      onProgress(Math.min(1, t / duration));
      if (signal?.aborted) { clearInterval(tick); rej(new DOMException('Запись остановлена', 'AbortError')); }
      else if (t >= duration) { clearInterval(tick); res(); }
    }, 1000 / 30);
  }).finally(() => {
    rec.stop(); audio?.pause(); void actx?.close();
    stream.getTracks().forEach((tr) => tr.stop());
  });
  await done;
  return { blob: new Blob(chunks, { type: type.mime.split(';')[0] }), ext: type.ext, withSound: !!audio };
}
