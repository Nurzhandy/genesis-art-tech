'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, type NewSong } from '@/lib/client/api';
import type { UploadFile } from '@/lib/validation';
import { processPhoto } from '@/lib/client/imageProcess';
import { SAMPLE, samplePhotoFiles } from '@/lib/client/sample';
import { DayTextInput } from './DayTextInput';
import { GenerateProgress } from './GenerateProgress';
import { PhotoPicker, type PickedPhoto } from './PhotoPicker';
import { SongInput, type SongState } from './SongInput';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function DayForm({ diaryId }: { diaryId: string }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [song, setSong] = useState<SongState>({ kind: 'none' });
  const [stage, setStage] = useState<'form' | 'upload' | 'generate'>('form');
  const [error, setError] = useState<string | null>(null);
  const [songKey, setSongKey] = useState(0);
  const [sampleBusy, setSampleBusy] = useState(false);

  async function fillSample() {
    setSampleBusy(true); setPhotosBusy(true); setError(null);
    try {
      setText(SAMPLE.text);
      const files = await samplePhotoFiles();
      const picked: PickedPhoto[] = [];
      for (const [i, f] of files.entries()) picked.push({ ...(await processPhoto(f, i)), id: crypto.randomUUID(), name: f.name });
      setPhotos(picked);
      // SongInput сам распознает ссылку: монтируем его заново с готовым адресом.
      setSong({ kind: 'link', url: SAMPLE.songUrl, status: 'checking', music: null });
      setSongKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось подставить пример');
    } finally {
      setSampleBusy(false); setPhotosBusy(false);
    }
  }

  const songReady = (song.kind === 'link' && song.status !== 'checking') || (song.kind === 'file' && song.status === 'ok');
  const canSubmit = text.trim().length > 0 && photos.length > 0 && !photosBusy && songReady && stage === 'form';
  const missing = [
    !text.trim() && 'расскажите о дне',
    !photos.length && 'добавьте хотя бы одно фото',
    !songReady && 'добавьте песню',
  ].filter(Boolean);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setStage('upload');
    try {
      const newSong: NewSong = song.kind === 'file'
        ? { kind: 'file', ext: song.ext, title: song.title }
        : song.kind === 'link' && song.song?.kind === 'link'
          ? song.song
          : { kind: 'link', url: (song as { url: string }).url, provider: 'other' };
      const { dayId } = await api.createDay(diaryId, { date, text: text.trim(), photoCount: photos.length, song: newSong });

      const files: UploadFile[] = photos.flatMap((_, i) => [
        { kind: 'photo' as const, index: i, ext: 'jpg' as const },
        { kind: 'thumb' as const, index: i, ext: 'jpg' as const },
      ]);
      if (song.kind === 'file') files.push({ kind: 'audio', ext: song.ext as 'mp3' });
      const { uploads } = await api.requestUploads(dayId, files);
      await Promise.all(uploads.map((u) => {
        const blob = u.kind === 'photo' ? photos[u.index!].full : u.kind === 'thumb' ? photos[u.index!].thumb : song.kind === 'file' ? song.file : null;
        return blob ? api.uploadFile(u, blob) : Promise.resolve();
      }));

      setStage('generate');
      await api.generate(dayId, { photoFeatures: photos.map((p) => p.features), music: 'music' in song ? song.music : null });
      router.push(`/day/${dayId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      setStage('form');
    }
  }

  if (stage === 'upload') return <GenerateProgress label="Складываю фото и песню в папку…" />;
  if (stage === 'generate') return <GenerateProgress />;

  return (
    <form onSubmit={submit} className="flex flex-col gap-10">
      <div className="-mb-4 flex flex-wrap items-center gap-3 rounded-sm border border-dashed border-foreground/20 px-4 py-3">
        <p className="flex-1 text-base text-muted">Хотите сначала посмотреть, как это работает? Подставим осенний день с песней Синатры.</p>
        <button type="button" onClick={fillSample} disabled={sampleBusy || photosBusy}
          className="rounded-full border border-foreground/30 px-4 py-2 font-mono text-xs uppercase tracking-wider transition hover:bg-foreground hover:text-background disabled:opacity-40">
          {sampleBusy ? 'подставляю…' : 'Заполнить примером'}
        </button>
      </div>

      <section>
        <label className="mb-2 block font-mono text-xs uppercase tracking-[0.2em] text-muted" htmlFor="date">дата</label>
        <input id="date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)}
          className="border-b border-foreground/30 bg-transparent py-1 font-mono text-sm outline-none focus:border-foreground" />
      </section>

      <section>
        <label className="mb-2 block font-mono text-xs uppercase tracking-[0.2em] text-muted" htmlFor="text">как прошёл день</label>
        <DayTextInput value={text} onChange={setText} />
      </section>

      <section>
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">фото дня · 1–5</p>
        <PhotoPicker photos={photos} onChange={setPhotos} onBusy={setPhotosBusy} />
      </section>

      <section>
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">песня дня</p>
        <SongInput key={songKey} value={song} onChange={setSong} />
      </section>

      {error && <p className="rounded-sm bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      <div className="flex flex-col items-start gap-2">
        <button type="submit" disabled={!canSubmit}
          className="rounded-full bg-foreground px-7 py-3 font-mono text-sm uppercase tracking-[0.15em] text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30">
          Собрать день
        </button>
        {missing.length > 0 && <p className="text-sm text-muted">Осталось: {missing.join(', ')}</p>}
        {photosBusy && <p className="text-sm text-muted">Обрабатываю фото…</p>}
      </div>

      <p className="border-t border-foreground/10 pt-5 text-sm leading-relaxed text-muted">
        Дневник открывается только по вашей ссылке. Текст и фото анализирует AI (Gemini), чтобы подобрать оформление;
        это настроение записи, а не оценка вашего состояния. Песню мы храним ссылкой; свой аудиофайл лежит в закрытой
        папке дня. Любой день можно скачать или удалить.
      </p>
    </form>
  );
}
