'use client';
// «Видео из фото»: загрузить фото → настроение по цветам → три подходящие песни → видео с переходами → поделиться.
import { useEffect, useMemo, useRef, useState } from 'react';
import { processPhoto, type ProcessedPhoto } from '@/lib/client/imageProcess';
import { localToday } from '@/lib/archive';
import type { Theme } from '@/lib/themes';
import type { DayRecord } from '@/lib/types';
import { photoVibe, VIBES } from '@/lib/videoVibe';

interface Track { id: number; title: string; artist: string; cover: string | null; previewUrl: string; url: string }
type Picked = ProcessedPhoto & { id: string; url: string };
const MAX = 20;

export function VideoMaker() {
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(0);
  const [title, setTitle] = useState('');
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [song, setSong] = useState<Track | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [video, setVideo] = useState<{ url: string; blob: Blob; ext: string; withSound: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);

  const features = photos.map((p, i) => ({ ...p.features, index: i }));
  const vibe = photos.length ? photoVibe(features) : null;
  const seed = useMemo(() => Math.round(features.reduce((s, f) => s + f.brightness * 1000 + f.warmth * 100, 0)), [features]);

  useEffect(() => {
    if (!vibe) return;
    let alive = true;
    fetch(`/api/music/suggest?vibe=${vibe}&seed=${seed}`).then((r) => r.json()).then((b: { tracks: Track[] }) => {
      if (!alive) return;
      setTracks(b.tracks);
      setSong((cur) => cur && b.tracks.some((t) => t.id === cur.id) ? cur : b.tracks[0] ?? null);
    }).catch(() => alive && setTracks([]));
    return () => { alive = false; };
  }, [vibe, seed]);
  useEffect(() => () => { audio.current?.pause(); }, []);

  async function add(files: FileList | null) {
    if (!files) return;
    setError(null);
    const list = [...files].slice(0, MAX - photos.length);
    setBusy(list.length);
    const out: Picked[] = [];
    for (const f of list) {
      try { const p = await processPhoto(f, photos.length + out.length); out.push({ ...p, id: crypto.randomUUID(), url: URL.createObjectURL(p.full) }); }
      catch (e) { setError(e instanceof Error ? e.message : 'Не получилось открыть фото'); }
      setBusy((b) => b - 1);
    }
    setPhotos((cur) => [...cur, ...out]);
    setVideo(null);
  }

  function preview(t: Track) {
    if (playing === t.id) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause();
    const a = new Audio(t.previewUrl);
    audio.current = a;
    void a.play().then(() => setPlaying(t.id)).catch(() => setPlaying(null));
    a.onended = () => setPlaying(null);
  }

  async function make() {
    if (!photos.length || !vibe) return;
    audio.current?.pause(); setPlaying(null);
    setError(null); setVideo(null); setProgress(0);
    const v = VIBES[vibe];
    const dates = photos.map((p) => p.takenAt?.slice(0, 10)).filter((d): d is string => !!d).sort();
    const date = dates[0] ?? localToday();
    const accents = photos.flatMap((p) => p.features.palette.slice(0, 1));
    const day = {
      id: 'video', diaryId: 'video', date, title: title.trim() || v.title, slug: 'video', text: '', status: 'ready', error: null, createdAt: date,
      photos: photos.map((p) => ({ path: p.id, thumbPath: p.id, url: p.url, thumbUrl: p.url, features: p.features })),
      song: { kind: 'link', url: song?.url ?? '', provider: 'deezer', title: song?.title, artist: song?.artist },
      songUrl: song?.previewUrl, music: null,
      analysis: { caption: song ? `♪ ${song.artist} — ${song.title}` : '' },
      style: { seed, palette: { bg: '#111', paper: '#111', ink: '#fff', accents: accents.length ? accents : ['#e0a030'] }, motion: { bpm: v.bpm } },
      voice: null, posterPath: null,
    } as unknown as DayRecord;
    const theme: Theme = { id: 'video', title: title.trim() || v.title, why: v.why, days: [day], photoCount: photos.length, colors: accents.slice(0, 4) };
    try {
      const { recordMontage } = await import('@/render/montage');
      const r = await recordMontage(theme, setProgress);
      setVideo({ url: URL.createObjectURL(r.blob), blob: r.blob, ext: r.ext, withSound: r.withSound });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось собрать видео');
    } finally { setProgress(null); }
  }

  async function share() {
    if (!video) return;
    const file = new File([video.blob], `${title.trim() || 'момент'}.${video.ext}`, { type: video.blob.type });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) { try { await nav.share({ files: [file], title: title || 'Мой момент' }); return; } catch { /* отменили */ } }
    const a = document.createElement('a'); a.href = video.url; a.download = file.name; a.click();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-foreground/15 bg-background/60 p-5 backdrop-blur">
          <p className="mb-3 text-xl">1. Фото <span className="text-muted">· {photos.length}/{MAX}</span></p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {photos.map((p, i) => (
              <figure key={p.id} className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-black/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt={`Фото ${i + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => setPhotos((cur) => cur.filter((x) => x.id !== p.id))} aria-label="Убрать фото"
                  className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white opacity-0 group-hover:opacity-100 focus:opacity-100">✕</button>
              </figure>
            ))}
            {Array.from({ length: busy }, (_, i) => <div key={`b${i}`} className="aspect-square animate-pulse rounded-lg bg-foreground/10" />)}
            {photos.length + busy < MAX && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-foreground/30 text-muted hover:text-foreground">
                <span className="text-3xl leading-none">+</span><span className="text-xs">фото</span>
                <input type="file" accept="image/*,.heic,.heif" multiple className="sr-only" onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
              </label>
            )}
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Название видео (необязательно)" aria-label="Название видео"
            className="mt-4 w-full border-b border-foreground/30 bg-transparent py-1.5 text-lg outline-none placeholder:text-muted/70 focus:border-foreground" />
        </section>

        {vibe && (
          <section className="rounded-2xl border border-foreground/15 bg-background/60 p-5 backdrop-blur">
            <p className="text-xl">2. Песня</p>
            <p className="mb-3 text-muted">Настроение фото: <b className="text-foreground">{VIBES[vibe].title}</b> — {VIBES[vibe].why}.</p>
            {tracks === null && <p className="text-muted">Подбираю песни…</p>}
            {tracks?.length === 0 && <p className="text-muted">Не получилось подобрать песню — видео соберётся без звука.</p>}
            <div className="flex flex-col gap-2">
              {tracks?.map((t) => (
                <div key={t.id} className={`flex items-center gap-3 rounded-xl border p-2 transition ${song?.id === t.id ? 'border-foreground bg-foreground/5' : 'border-foreground/15'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t.cover && <img src={t.cover} alt="" className="h-12 w-12 rounded-md object-cover" />}
                  <button type="button" onClick={() => setSong(t)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-lg leading-tight">{t.title}</p>
                    <p className="truncate text-sm text-muted">{t.artist}</p>
                  </button>
                  <button type="button" onClick={() => preview(t)} aria-label={playing === t.id ? 'Пауза' : 'Послушать'} className="rounded-full border border-foreground/20 px-3 py-1 text-sm">{playing === t.id ? '❚❚' : '▶'}</button>
                </div>
              ))}
            </div>
          </section>
        )}
        {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      </div>

      <aside className="flex flex-col gap-4">
        <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-black shadow-2xl">
          {video ? <video src={video.url} controls playsInline autoPlay className="h-full w-full object-cover" />
            : <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-white/70">
                {progress !== null ? <><p className="text-2xl text-white">Собираю видео…</p><span className="h-1.5 w-40 overflow-hidden rounded-full bg-white/20"><span className="block h-full bg-white" style={{ width: `${Math.round(progress * 100)}%` }} /></span></>
                  : <p className="font-hand text-2xl">здесь появится ваше видео</p>}
              </div>}
        </div>
        <button type="button" onClick={() => void make()} disabled={!photos.length || progress !== null || busy > 0}
          className="rounded-full bg-foreground px-6 py-3 text-lg text-background transition hover:opacity-90 disabled:opacity-30">
          {video ? 'Собрать заново' : '3. Собрать видео'}
        </button>
        {video && <button type="button" onClick={() => void share()} className="rounded-full border border-foreground/30 px-6 py-3 text-lg">Поделиться</button>}
        {video && !video.withSound && <p className="text-xs text-muted">Без звука: превью песни не загрузилось.</p>}
        <p className="text-xs text-muted">Видео пишется в реальном времени (до минуты). Песня — официальное 30-секундное превью Deezer.</p>
      </aside>
    </div>
  );
}
