'use client';
// «Войти в день» (22.11). ТЗ: «если зрителю захочется оказаться внутри него, значит, продукт работает».
// Делаем это буквально: слои страницы дня (тот же движок, engine.renderLayers) встают на разную глубину,
// камера медленно въезжает внутрь, мышь или наклон телефона двигают взгляд, частицы погоды летят
// перед лицом, звучит песня дня, потом — голос записи (музыка под ним стихает).
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { humanDate } from '@/lib/archive';
import { useStored } from '@/lib/client/diaryKey';
import type { DayRecord, StyleParams } from '@/lib/types';
import type { DayLayer } from '@/render/engine';
import type { RenderCtx } from '@/render/types';
import { songLabel } from './MemoryPlayer';

/** Глубина слоёв: дальше всего бумага, ближе всего — частицы погоды. Отрицательное — вглубь экрана. */
export const DEPTH: Partial<Record<DayLayer, number>> = {
  paper: -520, technique: -330, photo: -170, objects: -40, words: 40, decor: 90, grain: 120,
};
const PERSPECTIVE = 1000;
/** Масштаб, при котором слой на глубине z выглядит как на плоском постере (слои совпадают в покое). */
export const depthScale = (z: number) => (PERSPECTIVE - z) / PERSPECTIVE;

const VOICE_AT = 3.2;

export function DayEnter({ day, style, onClose }: { day: DayRecord; style: StyleParams; onClose: () => void }) {
  const [layers, setLayers] = useState<{ id: DayLayer; canvas: HTMLCanvasElement }[] | null>(null);
  const [error, setError] = useState(false);
  const [hint, setHint] = useState(true);
  const stage = useRef<HTMLDivElement>(null);
  const rig = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const back = useRef<HTMLCanvasElement>(null);
  const plates = useRef<(HTMLDivElement | null)[]>([]);
  const caption = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const mode: 'photo' | 'drawing' = useStored(`atmosphere-mode:${day.id}`) === 'drawing' ? 'drawing' : 'photo';
  const sound = useRef<{ music: HTMLAudioElement | null; voice: HTMLAudioElement | null }>({ music: null, voice: null });

  // Звук — сразу по нажатию «Войти в день», пока браузер помнит нажатие.
  useEffect(() => {
    const music = day.songUrl ? new Audio(day.songUrl) : null;
    if (music) { music.crossOrigin = 'anonymous'; music.loop = true; music.volume = 0; void music.play().then(() => gsap.to(music, { volume: 0.9, duration: 2.5 })).catch(() => undefined); }
    const voice = day.voice?.url ? new Audio(day.voice.url) : null;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (voice) {
      voice.preload = 'auto';
      t = setTimeout(() => {
        if (music) gsap.to(music, { volume: 0.25, duration: 0.8 });
        void voice.play().catch(() => undefined);
        voice.onended = () => { if (music) gsap.to(music, { volume: 0.9, duration: 1.5 }); };
      }, VOICE_AT * 1000);
    }
    sound.current = { music, voice };
    return () => {
      clearTimeout(t);
      music?.pause(); voice?.pause();
    };
  }, [day.songUrl, day.voice?.url]);

  // Слои страницы рисует тот же движок; погоду (атмосферу) рисуем вживую ниже — она должна двигаться.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { createEngine } = await import('@/render/engine');
        const photos = day.photos.map((p) => p.url ?? p.thumbUrl ?? '').filter(Boolean);
        const e = await createEngine(document.createElement('canvas'), {
          style, photoUrls: photos, mode,
          info: { title: day.title ?? '', caption: day.analysis?.caption ?? '', date: day.date, dayNumber: day.dayNumber, songLabel: songLabel(day), notes: day.analysis?.sensory, decor: day.decor },
        });
        // Зерно с виньеткой поверх всего в 3D выглядит серой пеленой с краями — здесь его нет, атмосфера живая ниже.
        const ls = e.renderLayers(12).filter((l) => l.id !== 'atmosphere' && l.id !== 'grain');
        e.destroy();
        if (alive) setLayers(ls);
      } catch { if (alive) setError(true); }
    })();
    return () => { alive = false; };
  }, [day, style, mode]);

  // Живая погода: частицы на двух планах — за фото и прямо перед лицом.
  useEffect(() => {
    if (!layers || style.atmosphere.kind === 'none') return;
    let raf = 0;
    let stop = false;
    (async () => {
      const { createAtmosphere } = await import('@/render/atmosphere');
      const { photoTime } = await import('@/render/timeline');
      const W = 1080, H = 1920;
      const planes = [front.current, back.current].filter(Boolean) as HTMLCanvasElement[];
      const runs = planes.map((c, i) => {
        c.width = W / 2; c.height = H / 2;
        const g = c.getContext('2d')!;
        g.setTransform(0.5, 0, 0, 0.5, 0, 0);
        const st = { ...style, seed: style.seed + i * 7919 };
        return { g, atm: createAtmosphere(st, W, H), rc: { ctx: g, W, H, style: st, energy: () => 0.45 } as unknown as RenderCtx };
      });
      const t0 = performance.now();
      const loop = () => {
        if (stop) return;
        const t = (performance.now() - t0) / 1000;
        for (const r of runs) { r.g.clearRect(0, 0, W, H); r.atm.draw(r.rc, photoTime(t, style.motion, 1)); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();
    return () => { stop = true; cancelAnimationFrame(raf); };
  }, [layers, style]);

  // Камера: въезд из глубины, потом медленный наезд «внутрь» и взгляд за мышью или наклоном телефона.
  useEffect(() => {
    if (!layers || !rig.current || !stage.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = plates.current.filter(Boolean) as HTMLDivElement[];
    const intro = gsap.timeline();
    // Прозрачность — только на внешней обёртке: opacity < 1 на 3D-узле «сплющивает» глубину.
    intro.fromTo(scene.current, { opacity: 0 }, { opacity: 1, duration: reduced ? 0.01 : 1.2, ease: 'power1.out' }, 0)
      .fromTo(rig.current, { z: -900, rotationX: 8 }, { z: 0, rotationX: 0, duration: reduced ? 0.01 : 2.4, ease: 'power3.out' }, 0)
      .fromTo(els, { z: (i) => Number(els[i].dataset.z) * 2.2 }, { z: (i) => Number(els[i].dataset.z), duration: reduced ? 0.01 : 2.2, ease: 'power3.out', stagger: 0.06 }, 0.2)
      .fromTo(caption.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out' }, 1.6);
    // Медленный наезд: за 40 секунд камера проходит глубже в день.
    const dolly = reduced ? null : gsap.to(stage.current, { z: 260, duration: 40, ease: 'sine.inOut', delay: 2.4, yoyo: true, repeat: -1 });

    const look = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      target.x = Math.max(-1, Math.min(1, e.gamma / 25));
      target.y = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('deviceorientation', onTilt);
    let raf = 0;
    const tick = () => {
      look.x += (target.x - look.x) * 0.06;
      look.y += (target.y - look.y) * 0.06;
      if (rig.current) gsap.set(rig.current, { rotationY: look.x * 9, rotationX: -look.y * 7 });
      raf = requestAnimationFrame(tick);
    };
    if (!reduced) raf = requestAnimationFrame(tick);
    const hideHint = setTimeout(() => setHint(false), 6000);
    return () => {
      intro.kill(); dolly?.kill(); cancelAnimationFrame(raf); clearTimeout(hideHint);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, [layers]);

  function close() {
    if (closing.current) return;
    closing.current = true;
    const { music, voice } = sound.current;
    if (music) gsap.to(music, { volume: 0, duration: 0.7 });
    if (voice) gsap.to(voice, { volume: 0, duration: 0.7 });
    gsap.to(rig.current, { z: -700, duration: 0.8, ease: 'power2.in' });
    gsap.to(scene.current, { opacity: 0, duration: 0.8, ease: 'power2.in', onComplete: onClose });
    setTimeout(onClose, 1200);
  }

  // iPhone спрашивает разрешение на наклон — по первому касанию.
  async function askTilt() {
    const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (D?.requestPermission) { try { await D.requestPermission(); } catch { /* без наклона — мышь и касание */ } }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.documentElement.style.overflow = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bg = style.palette.bg;
  const glow = style.palette.accents[0] ?? '#e0b84d';
  const plateH = 'min(84vh, 150vw)';

  return (
    <div role="dialog" aria-modal aria-label={`Внутри дня «${day.title ?? ''}»`} onPointerDown={askTilt}
      className="fixed inset-0 z-[75] overflow-hidden text-[#f4ece0]"
      style={{ background: `radial-gradient(70% 60% at 50% 45%, color-mix(in srgb, ${bg} 30%, #0b0907), #050403 75%)` }}>
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(40% 35% at 50% 45%, ${glow}33, transparent 70%)` }} />

      <div ref={scene} className="absolute inset-0 opacity-0">
      <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: `${PERSPECTIVE}px` }}>
        <div ref={stage} style={{ transformStyle: 'preserve-3d' }}>
          <div ref={rig} className="relative" style={{ height: plateH, aspectRatio: '9 / 16', transformStyle: 'preserve-3d' }}>
            {/* Погода за фото */}
            <canvas ref={back} aria-hidden className="absolute inset-0 h-full w-full opacity-70" style={{ transform: `translateZ(-250px) scale(${depthScale(-250) * 1.3})` }} />
            {layers?.map((l, i) => {
              const z = DEPTH[l.id] ?? 0;
              return (
                <div key={l.id} ref={(el) => { plates.current[i] = el; }} data-z={z} className="absolute inset-0"
                  style={{ transform: `translateZ(${z}px) scale(${depthScale(z) * (l.id === 'paper' ? 1.18 : 1)})`, transformStyle: 'preserve-3d' }}>
                  <canvas ref={(c) => { if (c && !c.dataset.drawn) { c.width = l.canvas.width; c.height = l.canvas.height; c.getContext('2d')!.drawImage(l.canvas, 0, 0); c.dataset.drawn = '1'; } }}
                    className="h-full w-full" style={{ boxShadow: l.id === 'paper' ? '0 60px 140px rgba(0,0,0,0.7)' : undefined, opacity: l.id === 'grain' ? 0.6 : 1 }} />
                </div>
              );
            })}
            {/* Погода перед лицом: частицы крупнее и ближе всех слоёв */}
            <canvas ref={front} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" style={{ transform: `translateZ(260px) scale(${depthScale(260) * 1.25})` }} />
          </div>
        </div>
      </div>
      </div>

      {/* Пока движок раскладывает слои, на экране уже готовый постер дня — 3D разворачивается из него. */}
      {!layers && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {day.posterUrl && <img src={day.posterUrl} alt="" className="rounded-sm shadow-[0_60px_140px_rgba(0,0,0,0.7)]" style={{ height: 'min(84vh, 150vw)', aspectRatio: '9 / 16', animation: 'pop-in 0.6s ease-out both' }} />}
          <p className="absolute bottom-10 font-hand text-3xl opacity-80">Открываю день…</p>
        </div>
      )}
      {error && <p className="absolute inset-0 grid place-items-center px-6 text-center text-lg">Не получилось открыть день. Обновите страницу и попробуйте ещё раз.</p>}

      <div ref={caption} className="pointer-events-none absolute inset-x-0 bottom-8 flex flex-col items-center gap-1 px-6 text-center opacity-0">
        <p className="font-hand text-4xl leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-5xl">{day.title}</p>
        <p className="text-lg text-[#f4ece0]/70">{humanDate(day.date)}{songLabel(day) ? ` · ♪ ${songLabel(day)}` : ''}</p>
      </div>

      <button type="button" onClick={close}
        className="absolute right-5 top-5 rounded-full border border-[#f4ece0]/30 bg-black/30 px-5 py-2.5 text-lg backdrop-blur transition hover:bg-[#f4ece0] hover:text-[#0b0907] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4ece0]">
        Выйти из дня
      </button>
      <p className="pointer-events-none absolute left-5 top-6 text-base text-[#f4ece0]/55 transition-opacity duration-1000" style={{ opacity: hint && layers ? 1 : 0 }}>
        Ведите мышью или наклоните телефон
      </p>
    </div>
  );
}
