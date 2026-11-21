'use client';
// «Как собран этот день» (21.11): постер дня раскладывается в 3D-стопку прозрачных слоёв, как чертёж
// в разобранном виде. Каждый слой рисует тот же движок (engine.renderLayers), а подпись к слою —
// причина из «Почему так». Невидимые правила становятся видимыми буквально — суть кейса.
// Наведение на слой (или на строку списка) поднимает его из стопки и гасит остальные.
import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useStored } from '@/lib/client/diaryKey';
import type { DayRecord, StyleParams, StyleReason } from '@/lib/types';
import type { DayLayer } from '@/render/engine';
import { songLabel } from './MemoryPlayer';

const LAYER_INFO: Record<DayLayer, { title: string; params: string[]; fallback: string }> = {
  paper: { title: 'Бумага и палитра', params: ['feeling', 'override', 'palette', 'cover'], fallback: 'Цвет бумаги и чернил — из палитры дня.' },
  technique: { title: 'Художественная техника', params: ['technique', 'genre', 'negativeSpace'], fallback: 'Техника выбрана по настроению записи, фото и песне.' },
  photo: { title: 'Фото и свет', params: ['portrait', 'light', 'detail', 'motion', 'rhythm'], fallback: 'Ваше фото — главное: техника остаётся фоном и рамкой.' },
  atmosphere: { title: 'Атмосфера и погода', params: ['atmosphere', 'weather', 'wind'], fallback: 'Частицы атмосферы — из погоды и слов записи.' },
  objects: { title: 'Марки и песня', params: ['stamps', 'songObject'], fallback: 'Марка сезона, штемпель с датой и песня как предмет.' },
  words: { title: 'Слова дня', params: [], fallback: 'Название папки и рукописная подпись придуманы по вашей записи.' },
  decor: { title: 'Ваши украшения', params: ['decor'], fallback: 'Стикеры, заметки и кисть, которые вы добавили сами.' },
  grain: { title: 'Зерно и время', params: ['grain', 'age', 'jitter'], fallback: 'Плёночное зерно и виньетка — общие для всех дней.' },
};

/** Причины для слоя: первые совпавшие параметры из «Почему так» (не больше двух). В режиме «Рисунок» техника — это сцена. */
export function layerReasons(id: DayLayer, reasons: StyleReason[], mode: 'photo' | 'drawing' = 'photo'): string[] {
  const info = LAYER_INFO[id];
  const params = id === 'technique' && mode === 'drawing' ? ['scene', ...info.params] : info.params;
  const found = params.flatMap((p) => reasons.filter((r) => r.param === p).map((r) => r.because)).slice(0, 2);
  return found.length ? found : [info.fallback];
}

export function DayLayers({ day, style, onClose }: { day: DayRecord; style: StyleParams; onClose: () => void }) {
  const [layers, setLayers] = useState<{ id: DayLayer; canvas: HTMLCanvasElement }[] | null>(null);
  const [error, setError] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const plates = useRef<(HTMLDivElement | null)[]>([]);
  const list = useRef<HTMLOListElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const closing = useRef(false);
  const mode: 'photo' | 'drawing' = useStored(`atmosphere-mode:${day.id}`) === 'drawing' ? 'drawing' : 'photo';
  const reasons = useMemo(() => style.reasons, [style]);

  // Рисуем слои тем же движком, что и страница дня (момент t = 12 с: страница полностью собрана).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { createEngine } = await import('@/render/engine');
        const off = document.createElement('canvas');
        const photos = day.photos.map((p) => p.url ?? p.thumbUrl ?? '').filter(Boolean);
        const e = await createEngine(off, {
          style, photoUrls: photos, mode,
          info: { title: day.title ?? '', caption: day.analysis?.caption ?? '', date: day.date, dayNumber: day.dayNumber, songLabel: songLabel(day), notes: day.analysis?.sensory, decor: day.decor },
        });
        const ls = e.renderLayers(12);
        e.destroy();
        if (alive) setLayers(ls);
      } catch { if (alive) setError(true); }
    })();
    return () => { alive = false; };
  }, [day, style, mode]);

  // Раскладка: постер поворачивается в изометрию, слои разлетаются по высоте, подписи появляются по одной.
  useEffect(() => {
    if (!layers || !stage.current) return;
    const els = plates.current.slice(0, layers.length).filter(Boolean) as HTMLDivElement[];
    const items = list.current ? Array.from(list.current.children) : [];
    const gap = window.innerWidth < 700 ? 34 : 62;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = gsap.timeline({ defaults: { ease: 'power3.inOut' } });
    gsap.set(stage.current, { rotationX: 0, rotationZ: 0, transformPerspective: 2200 });
    gsap.set(els, { z: 0 });
    gsap.set(items, { opacity: 0, x: 24 });
    t.to(stage.current, { rotationX: 58, rotationZ: -34, duration: 1.1 }, 0.25)
      .to(els, { z: (i) => i * gap, duration: 1.3, stagger: 0.07 }, 0.9)
      .to(items, { opacity: 1, x: 0, duration: 0.5, stagger: 0.09, ease: 'power2.out' }, 1.3);
    if (reduced) t.progress(1);
    tl.current = t;
    return () => { t.kill(); };
  }, [layers]);

  // Наведение: слой поднимается из стопки, остальные гаснут.
  useEffect(() => {
    if (!layers) return;
    const gap = window.innerWidth < 700 ? 34 : 62;
    plates.current.slice(0, layers.length).forEach((el, i) => {
      if (!el) return;
      gsap.to(el, { z: i * gap + (active === i ? 70 : 0), opacity: active === null || active === i ? 1 : 0.18, duration: 0.45, ease: 'power2.out', overwrite: 'auto' });
    });
  }, [active, layers]);

  function close() {
    if (closing.current) return;
    closing.current = true;
    const t = tl.current;
    if (t && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Стопка складывается обратно в постер; если анимация не успела (вкладка в фоне) — закрываем всё равно.
      let done = false;
      const finish = () => { if (!done) { done = true; onClose(); } };
      t.timeScale(1.8).reverse();
      t.eventCallback('onReverseComplete', finish);
      setTimeout(finish, 1600);
    }
    else onClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.documentElement.style.overflow = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div role="dialog" aria-modal aria-label="Как собран этот день" className="fixed inset-0 z-[70] overflow-y-auto overflow-x-hidden bg-[#0d0a08]/95 text-[#efe6d8] backdrop-blur-sm"
      style={{ animation: 'pop-in 0.35s ease-out both' }}>
      <div className="pointer-events-none fixed inset-0" style={{ background: `radial-gradient(50% 45% at 38% 50%, ${style.palette.accents[0] ?? '#c8892b'}2a, transparent 70%)` }} />
      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col gap-4 px-4 py-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">Как собран этот день</h2>
            <p className="mt-1 text-lg text-[#efe6d8]/60">{layers ? `${layers.length} слоёв, у каждого своё правило` : error ? '' : 'Раскладываю страницу на слои…'}</p>
          </div>
          <button type="button" onClick={close} className="shrink-0 rounded-full border border-[#efe6d8]/30 px-5 py-2.5 text-lg transition hover:bg-[#efe6d8] hover:text-[#0d0a08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#efe6d8]">
            Собрать обратно
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
        {/* 3D-стопка слоёв */}
        <div className="flex min-h-[60vh] min-w-0 flex-1 items-center justify-center lg:min-h-[74vh]" style={{ perspective: '2200px' }}>
          {error && <p className="max-w-sm text-center text-lg">Не получилось разложить страницу. Обновите её и попробуйте ещё раз.</p>}
          {!layers && !error && <div className="h-[46vh] w-[26vh] animate-pulse rounded-sm bg-[#efe6d8]/10" />}
          {layers && (
            <div ref={stage} className="relative" style={{ width: 'min(42vw, 30vh, 300px)', aspectRatio: '9 / 16', transformStyle: 'preserve-3d' }}>
              {layers.map((l, i) => (
                <div key={l.id} ref={(el) => { plates.current[i] = el; }} onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)}
                  className="absolute inset-0 cursor-pointer" style={{ transformStyle: 'preserve-3d' }}>
                  <canvas ref={(c) => { if (c && !c.dataset.drawn) { c.width = l.canvas.width; c.height = l.canvas.height; c.getContext('2d')!.drawImage(l.canvas, 0, 0); c.dataset.drawn = '1'; } }}
                    className="h-full w-full" style={{ boxShadow: i === 0 ? '0 40px 80px rgba(0,0,0,0.6)' : `0 0 0 1px ${active === i ? '#e0b84d' : 'rgba(239,230,216,0.22)'}`, background: i === 0 ? undefined : 'rgba(239,230,216,0.03)' }} />
                  <span className="absolute -left-3 -top-3 grid h-7 w-7 place-items-center rounded-full bg-[#efe6d8] text-sm font-semibold text-[#0d0a08] shadow">{i + 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Подписи слоёв: сверху вниз — как лежат в стопке */}
        {layers && (
          <ol ref={list} className="flex w-full flex-col-reverse gap-1 lg:w-[400px] lg:shrink-0">
            {layers.map((l, i) => (
              <li key={l.id}>
                <button type="button" onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                  className={`flex w-full gap-3 rounded-lg px-3 py-2.5 text-left transition ${active === i ? 'bg-[#efe6d8]/10' : ''} focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0b84d]`}>
                  <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold ${active === i ? 'bg-[#e0b84d] text-[#0d0a08]' : 'bg-[#efe6d8]/15'}`}>{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-xl font-semibold leading-tight">{LAYER_INFO[l.id].title}</span>
                    {(l.id === 'words' && day.title
                      ? [`«${day.title}» — название папки, придуманное по вашей записи; рукописная подпись — из её деталей.`]
                      : layerReasons(l.id, reasons, mode)).map((r) => <span key={r} className="mt-0.5 block text-base leading-snug text-[#efe6d8]/65">{r}</span>)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
        </div>
      </div>
    </div>
  );
}
