'use client';
// «Фильмы»: дневник сам находит общие темы дней и собирает из всех их фото одно видео.
import { useMemo, useRef, useState } from 'react';
import { findThemes, montagePlan, type Theme } from '@/lib/themes';
import type { DayRecord } from '@/lib/types';

type Job = { id: string; progress: number } | null;
type Done = { id: string; url: string; blob: Blob; ext: string; withSound: boolean };

export function ThemeFilms({ days }: { days: DayRecord[] }) {
  const themes = useMemo(() => findThemes(days), [days]);
  const [job, setJob] = useState<Job>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  async function make(t: Theme) {
    setError(null);
    if (done) URL.revokeObjectURL(done.url);
    setDone(null);
    abort.current = new AbortController();
    setJob({ id: t.id, progress: 0 });
    try {
      const { recordMontage } = await import('@/render/montage');
      const r = await recordMontage(t, (p) => setJob({ id: t.id, progress: p }), abort.current.signal);
      setDone({ id: t.id, url: URL.createObjectURL(r.blob), blob: r.blob, ext: r.ext, withSound: r.withSound });
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') setError(e instanceof Error ? e.message : 'Не получилось собрать фильм');
    } finally {
      setJob(null);
    }
  }

  if (!themes.length) {
    return <p className="py-16 text-center font-hand text-3xl text-muted">Фильмы появятся, когда в дневнике будет хотя бы два дня с фото.</p>;
  }

  return (
    <div>
      <p className="mb-6 max-w-2xl text-lg leading-relaxed text-muted">
        Дневник сам нашёл, что объединяет ваши дни. Выберите тему — и все её фото соберутся в одно видео
        с наездом камеры, плавными переходами и подписью каждого дня.
      </p>
      {error && <p className="mb-4 text-sm text-red-700 dark:text-red-400">{error}</p>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((t) => {
          const { duration } = montagePlan(t);
          const running = job?.id === t.id;
          const ready = done?.id === t.id ? done : null;
          const bg = t.colors.length > 1 ? `linear-gradient(135deg, ${t.colors.slice(0, 4).join(', ')})` : t.colors[0] ?? '#7a6a55';
          return (
            <article key={t.id} className="overflow-hidden rounded-2xl border border-foreground/10 shadow-sm">
              {ready ? (
                <video src={ready.url} controls playsInline className="aspect-[9/16] w-full bg-black object-cover" />
              ) : (
                <div className="relative flex aspect-[16/10] flex-col justify-end p-5 text-white" style={{ background: bg }}>
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute right-4 top-4 flex -space-x-3">
                    {t.days.slice(0, 4).map((d) => d.photos[0]?.thumbUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={d.id} src={d.photos[0].thumbUrl} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white/80" />
                    ))}
                  </div>
                  <h3 className="relative text-3xl font-semibold leading-tight">{t.title}</h3>
                  <p className="relative font-hand text-xl text-white/85">{t.why}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 p-4">
                <p className="flex-1 text-sm text-muted">{t.days.length} дн. · {t.photoCount} фото · ~{Math.round(duration)} с</p>
                {running ? (
                  <>
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-foreground/10" aria-label="Собираю фильм">
                      <span className="block h-full bg-foreground" style={{ width: `${Math.round((job?.progress ?? 0) * 100)}%` }} />
                    </span>
                    <button type="button" onClick={() => abort.current?.abort()} className="text-sm text-muted underline-offset-4 hover:underline">стоп</button>
                  </>
                ) : ready ? (
                  <a href={ready.url} download={`${t.title}.${ready.ext}`} className="rounded-full bg-foreground px-4 py-1.5 text-sm text-background">Скачать</a>
                ) : (
                  <button type="button" disabled={!!job} onClick={() => void make(t)}
                    className="rounded-full bg-foreground px-4 py-1.5 text-sm text-background transition hover:opacity-90 disabled:opacity-30">
                    Собрать фильм
                  </button>
                )}
              </div>
              {ready && !ready.withSound && <p className="px-4 pb-4 text-xs text-muted">Без звука: песни по ссылке Spotify/YouTube нельзя записать в видео.</p>}
            </article>
          );
        })}
      </div>
      {job && <p className="mt-4 text-sm text-muted">Фильм пишется в реальном времени — оставьте вкладку открытой.</p>}
    </div>
  );
}
