'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useStored, writeStored } from '@/lib/client/diaryKey';
import { humanDate } from '@/lib/archive';
import { commonShotDate, shotHour } from '@/lib/client/exif';
import { api, type NewSong } from '@/lib/client/api';
import type { UploadFile } from '@/lib/validation';
import { processPhoto } from '@/lib/client/imageProcess';
import { SAMPLE, samplePhotoFiles } from '@/lib/client/sample';
import { DayTextInput } from './DayTextInput';
import { FeelingPicker } from './FeelingPicker';
import { RotatingQuestion } from './RotatingQuestion';
import { GenerateProgress } from './GenerateProgress';
import { PhotoPicker, type PickedPhoto } from './PhotoPicker';
import { SongInput, type SongState } from './SongInput';
import { StoryRecorder, type StoryOutcome } from './StoryRecorder';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const PLACE_KEY = 'diary-place';
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function DayForm({ diaryId, prompt, questions, startWithStory = false }: { diaryId: string; prompt?: string; questions?: string[]; startWithStory?: boolean }) {
  // Пришли с главной по «Рассказать о сегодня» — сразу показываем запись голосом.
  useEffect(() => { if (startWithStory) document.getElementById('story')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [startWithStory]);
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
  // «Рассказать день»: запись голоса, если человек решил оставить её в папке дня.
  const [ownVoice, setOwnVoice] = useState<StoryOutcome['voice']>(null);
  // Черновик без давления: текст тихо сохраняется на устройстве, можно уйти и вернуться позже.
  const draftKey = `diary-draft:${diaryId}`;
  const savedDraft = useStored(draftKey);
  useEffect(() => {
    if (!text.trim()) return;
    const t = setTimeout(() => writeStored(draftKey, text), 700);
    return () => clearTimeout(t);
  }, [text, draftKey]);
  const offerDraft = !text && savedDraft && savedDraft.trim() ? savedDraft : null;
  // Город для погоды того дня (план 20.11, A1) — запоминаем на устройстве.
  // Трекер эмоций: одно слово-чувство человека.
  const [feeling, setFeeling] = useState<string[]>([]);
  const [place, setPlace] = useState(() => { try { return localStorage.getItem(PLACE_KEY) ?? ''; } catch { return ''; } });
  // Капсула времени (A5).
  const [sealOn, setSealOn] = useState(false);
  const [sealedUntil, setSealedUntil] = useState(() => addDays(today(), 365));
  // Дата съёмки из EXIF (A2): все фото в один день, а в форме другой — предлагаем поставить его.
  const shotDate = commonShotDate(photos.map((p) => p.takenAt));
  // Место съёмки из GPS фото (айфон пишет координаты): «Павлодар, Иртыш».
  const gps = photos.find((p) => p.gps)?.gps ?? null;
  const gpsKey = gps ? `${gps.lat},${gps.lon}` : '';
  const [photoPlace, setPhotoPlace] = useState<string | null>(null);
  useEffect(() => {
    if (!gpsKey) return;
    let alive = true;
    const [lat, lon] = gpsKey.split(',');
    fetch(`/api/place?lat=${lat}&lon=${lon}`).then((r) => r.json()).then((b: { place?: string | null }) => {
      if (!alive || !b.place) return;
      setPhotoPlace(b.place);
      setPlace((cur) => cur.trim() ? cur : b.place!);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [gpsKey]);
  const suggestDate = shotDate && shotDate !== date && shotDate <= today() ? shotDate : null;

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

  function applyStory(o: StoryOutcome) {
    setText((prev) => (prev.trim() ? `${prev.trim()}

${o.entry}` : o.entry).slice(0, 5000));
    if (o.place && !place.trim()) setPlace(o.place);
    if (o.songUrl && song.kind === 'none') {
      setSong({ kind: 'link', url: o.songUrl, status: 'checking', music: null });
      setSongKey((k) => k + 1);
    }
    if (o.voice) setOwnVoice(o.voice);
  }

  const sealError = sealOn && !(sealedUntil > today()) ? 'дата капсулы — в будущем' : null;
  // Фото и песня — по желанию: день можно записать одними словами.
  const songWait = (song.kind === 'link' && song.status === 'checking') || (song.kind === 'file' && song.status === 'checking');
  const songBroken = song.kind === 'file' && song.status === 'error';
  const canSubmit = text.trim().length > 0 && !photosBusy && !songWait && !songBroken && stage === 'form' && !sealError;
  const missing = [
    !text.trim() && 'расскажите о дне',
    songWait && 'проверяю песню…',
    songBroken && 'файл песни не прочитался — замените или уберите его',
    sealError,
  ].filter(Boolean);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setStage('upload');
    try {
      const newSong: NewSong = song.kind === 'none' || (song.kind === 'link' && !song.url.trim())
        ? { kind: 'none' }
        : song.kind === 'file'
        ? { kind: 'file', ext: song.ext, title: song.title }
        : song.kind === 'link' && song.song?.kind === 'link'
          ? song.song
          : { kind: 'link', url: (song as { url: string }).url, provider: 'other' };
      const city = place.trim();
      try { if (city) localStorage.setItem(PLACE_KEY, city); else localStorage.removeItem(PLACE_KEY); } catch { /* не критично */ }
      const { dayId } = await api.createDay(diaryId, {
        date, text: text.trim(), photoCount: photos.length, song: newSong,
        ...(city ? { place: city } : {}), ...(sealOn ? { sealedUntil } : {}), ...(feeling.length ? { feeling: feeling.join(', ') } : {}),
      });

      const files: UploadFile[] = photos.flatMap((_, i) => [
        { kind: 'photo' as const, index: i, ext: 'jpg' as const },
        { kind: 'thumb' as const, index: i, ext: 'jpg' as const },
      ]);
      if (song.kind === 'file') files.push({ kind: 'audio', ext: song.ext as 'mp3' });
      if (files.length) {
        const { uploads } = await api.requestUploads(dayId, files);
        await Promise.all(uploads.map((u) => {
          const blob = u.kind === 'photo' ? photos[u.index!].full : u.kind === 'thumb' ? photos[u.index!].thumb : song.kind === 'file' ? song.file : null;
          return blob ? api.uploadFile(u, blob) : Promise.resolve();
        }));
      }

      setStage('generate');
      await api.generate(dayId, {
        photoFeatures: photos.map((p) => p.features),
        music: 'music' in song ? song.music : null,
        coverPalette: song.kind === 'link' ? song.coverPalette : undefined,
        photoHour: shotHour(photos.map((p) => p.takenAt), date),
      });
      // Свой голос из рассказа — в папку дня; плеер дальше играет его вместо синтеза.
      if (ownVoice) {
        try {
          const { uploads: [u] } = await api.requestUploads(dayId, [{ kind: 'voice', ext: ownVoice.ext }]);
          await api.uploadFile(u, ownVoice.blob);
        } catch { /* голос — бонус: день уже собран */ }
      }
      writeStored(draftKey, '');
      router.push(`/day/${dayId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      setStage('form');
    }
  }

  if (stage === 'upload') return <GenerateProgress label={photos.length || song.kind !== 'none' ? 'Складываю фото и песню в папку…' : 'Складываю запись в папку…'} />;
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
        {suggestDate && (
          <button type="button" onClick={() => setDate(suggestDate)}
            className="mt-2 block text-left text-sm text-muted underline decoration-dotted underline-offset-4 hover:text-foreground">
            Фото сделаны {humanDate(suggestDate)} — поставить эту дату?
          </button>
        )}
      </section>

      <section>
        <label className="mb-2 block font-mono text-xs uppercase tracking-[0.2em] text-muted" htmlFor="place">город · необязательно</label>
        <input id="place" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={80} autoComplete="address-level2"
          placeholder="Астана"
          className="w-full max-w-xs border-b border-foreground/30 bg-transparent py-1 text-lg outline-none placeholder:text-muted/60 focus:border-foreground" />
        {photoPlace && place.trim() !== photoPlace && (
          <button type="button" onClick={() => setPlace(photoPlace)} className="mt-1 block text-left text-sm text-muted underline decoration-dotted underline-offset-4 hover:text-foreground">
            Фото сняты здесь: {photoPlace} — подставить?
          </button>
        )}
        {photoPlace && place.trim() === photoPlace && <p className="mt-1 text-sm text-muted">📍 Место взято из фото.</p>}
        <p className="mt-1 text-sm text-muted">Узнаем погоду того дня: дождь, снег или мороз будут видны в воспоминании.</p>
      </section>

      <section>
        <label className="mb-2 block font-mono text-xs uppercase tracking-[0.2em] text-muted" htmlFor="text">как прошёл день</label>
        {questions && <RotatingQuestion questions={questions} paused={text.length > 0} />}
        {offerDraft && (
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-dashed border-foreground/25 px-4 py-3">
            <p className="min-w-0 flex-1 basis-64 text-base text-muted">С прошлого раза остался черновик: <span className="font-hand text-xl text-foreground">«{offerDraft.slice(0, 70)}{offerDraft.length > 70 ? '…' : ''}»</span></p>
            <button type="button" onClick={() => setText(offerDraft)} className="rounded-full bg-foreground px-4 py-1.5 text-base text-background">Продолжить</button>
            <button type="button" onClick={() => writeStored(draftKey, '')} className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">Начать с чистого листа</button>
          </div>
        )}
        <div className="mb-4"><StoryRecorder onUse={applyStory} hasText={!!text.trim()} highlight={startWithStory} /></div>
        <DayTextInput value={text} onChange={setText} placeholder={prompt} />
        {text.trim() && <p className="mt-1 text-sm text-muted">Черновик сохраняется на этом устройстве — можно вернуться позже.</p>}
        {ownVoice && <p className="mt-2 text-sm text-muted">Ваш рассказ голосом ляжет в папку дня. <button type="button" onClick={() => setOwnVoice(null)} className="underline underline-offset-4 hover:text-foreground">Не сохранять голос</button></p>}
      </section>

      <section>
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">что вы чувствовали</p>
        <FeelingPicker value={feeling} onChange={setFeeling} />
      </section>

      <section>
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">фото дня · до 5 · по желанию</p>
        <PhotoPicker photos={photos} onChange={setPhotos} onBusy={setPhotosBusy} />
      </section>

      <section>
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">песня дня · по желанию</p>
        <SongInput key={songKey} value={song} onChange={setSong} />
      </section>

      <section className="rounded-sm border border-dashed border-foreground/20 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" checked={sealOn} onChange={(e) => setSealOn(e.target.checked)} className="h-4 w-4 accent-current" />
          <span className="text-lg">✉ Запечатать как капсулу времени</span>
        </label>
        {sealOn && (
          <div className="mt-3 flex flex-wrap items-center gap-3 pl-7">
            <label htmlFor="seal" className="text-sm text-muted">откроется</label>
            <input id="seal" type="date" value={sealedUntil} min={addDays(today(), 1)} max={addDays(today(), 3650)} onChange={(e) => setSealedUntil(e.target.value)}
              className="border-b border-foreground/30 bg-transparent py-1 font-mono text-sm outline-none focus:border-foreground" />
            <p className="w-full text-sm text-muted">До этой даты в архиве будет только конверт с названием — даже для вас.</p>
          </div>
        )}
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
