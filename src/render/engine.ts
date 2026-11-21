// Движок воспоминания: фото + стиль → живой холст 9:16 (B2, B7).
import type { StyleParams, Technique } from '@/lib/types';
import { LAYOUT } from '@/lib/style/constants';
import { assemblyAt } from './assembly';
import { createAtmosphere } from './atmosphere';
import { drawNotes, placeNotes } from './notes';
import { drawSongObject } from './songObject';
import { createPhotoFirst } from './photoFirst';
import { createScene } from './scene';
import { personMask } from './segment';
import { rhythmFromBeat, type Rhythm } from './audioReactive';
import { ageEffect } from '@/lib/style/visual';
import { drawDecor } from './decor';
import { drawStamps } from './stamps';
import { clamp } from './draw';
import { drawGrain, drawVignette, makeGrainTile } from './fx';
import { drawConstants, makePaper, zoneOf } from './layout';
import { createCollage } from './techniques/collage';
import { createFilm } from './techniques/film';
import { createGeometric } from './techniques/geometric';
import { createImpressionist } from './techniques/impressionist';
import { createMinimal } from './techniques/minimal';
import { intervalSec, photoTime, type PhotoTime } from './timeline';
import type { DayInfo, Fonts, RenderCtx, RenderPhoto, TechniqueRenderer } from './types';

const FACTORY: Record<Technique, () => TechniqueRenderer> = {
  impressionist: createImpressionist,
  geometric: createGeometric,
  minimal: createMinimal,
  film: createFilm,
  collage: createCollage,
};

export interface EngineOptions {
  style: StyleParams;
  photoUrls: string[];
  info: DayInfo;
  /** Живой уровень громкости 0..1 (если звук идёт через наш <audio>). */
  liveEnergy?: () => number | null;
  overrideTechnique?: { primary?: Technique; secondary?: Technique | null; mix?: number };
  /** Обои без текста (план 20.11, C1): без названия, подписи, заметок, марки и песни-предмета. */
  noText?: boolean;
  /** Экспорт (обои, видео): всегда 1080×1920, даже на телефоне. */
  fullRes?: boolean;
  /** «Фото» — фото дня в технике; «Рисунок» — нарисованная сцена дня (небо, место, люди) с фото-полароидом. */
  mode?: 'photo' | 'drawing';
  /** B11 V2: живой ритм песни (полосы и удары); без него ритм берётся из BPM. */
  liveRhythm?: () => Rhythm | null;
  /** B11 V6: «сегодня» для возраста дня (yyyy-mm-dd); по умолчанию — дата устройства. */
  today?: string;
}

/** Слои страницы дня снизу вверх — для «Как собран этот день». */
export const DAY_LAYERS = ['paper', 'technique', 'photo', 'atmosphere', 'objects', 'words', 'decor', 'grain'] as const;
export type DayLayer = (typeof DAY_LAYERS)[number];

export interface Engine {
  renderAt(t: number): void;
  /** Каждый слой страницы в момент t — на своём прозрачном холсте того же размера. */
  renderLayers(t: number): { id: DayLayer; canvas: HTMLCanvasElement }[];
  play(fromT?: number): void;
  pause(): void;
  destroy(): void;
  readonly canvas: HTMLCanvasElement;
  readonly interval: number;
}

export async function loadImage(url: string): Promise<RenderPhoto> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  // Ждём обычную загрузку: в свёрнутой или скрытой вкладке img.decode() может не завершиться никогда
  // (так «зависали» лаборатория и фильмы). decode — только бонус для плавности, не дольше 1,5 с.
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Не удалось загрузить фото: ${url.slice(0, 80)}`));
    img.src = url;
    if (img.complete && img.naturalWidth) resolve();
  });
  await Promise.race([img.decode().catch(() => undefined), new Promise((r) => setTimeout(r, 1500))]);
  return { img, w: img.naturalWidth, h: img.naturalHeight };
}

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export async function loadFonts(): Promise<Fonts> {
  const fonts: Fonts = {
    serif: cssVar('--font-cormorant', `'${LAYOUT.fonts.title}', Georgia, serif`),
    mono: cssVar('--font-jetbrains', `'${LAYOUT.fonts.mono}', monospace`),
    hand: cssVar('--font-caveat', `'${LAYOUT.fonts.hand}', cursive`),
  };
  try {
    await Promise.all([
      document.fonts.load(`400 40px ${fonts.serif}`, 'Дневник'),
      document.fonts.load(`700 40px ${fonts.serif}`, 'Дневник'),
      document.fonts.load(`500 20px ${fonts.mono}`, 'ДЕНЬ'),
      document.fonts.load(`500 40px ${fonts.hand}`, 'день'),
    ]);
  } catch { /* шрифты не критичны */ }
  return fonts;
}

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Абстрактная «акварель» из палитры дня — картинка для дня, где только слова. */
export function paletteWash(style: StyleParams): RenderPhoto {
  const w = 900, h = 1200;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const { bg, accents } = style.palette;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  let seed = style.seed || 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 9; i++) {
    const x = rand() * w, y = rand() * h, r = 220 + rand() * 420;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, accents[i % accents.length] + 'cc');
    grad.addColorStop(1, accents[i % accents.length] + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }
  g.globalCompositeOperation = 'source-over';
  return { img: c, w, h };
}

export async function createEngine(canvas: HTMLCanvasElement, opts: EngineOptions): Promise<Engine> {
  const W = LAYOUT.width, H = LAYOUT.height;
  const lowPower = typeof window !== 'undefined' && window.innerWidth < 500 && window.devicePixelRatio > 2;
  const k = lowPower && !opts.fullRes ? 0.5 : 1;
  canvas.width = W * k;
  canvas.height = H * k;
  const ctx = canvas.getContext('2d')!;

  const [loaded, fonts] = await Promise.all([Promise.all(opts.photoUrls.map(loadImage)), loadFonts()]);

  const style: StyleParams = opts.overrideTechnique
    ? { ...opts.style, techniques: { ...opts.style.techniques, ...opts.overrideTechnique } }
    : opts.style;
  // День без фото — тоже день: вместо снимка акварель из цветов настроения.
  const photos = loaded.length ? loaded : [paletteWash(style)];
  const energyBase = clamp((style.motion.jitter - 0.1) / 0.6);
  const energy = (pt: PhotoTime) => {
    const live = opts.liveEnergy?.();
    const beat = Math.exp(-pt.beatPhase * 6) * (0.35 + 0.65 * energyBase);
    return live == null ? beat : clamp(0.5 * live + 0.5 * beat);
  };

  const rc: RenderCtx = { ctx, W, H, style, photos, zone: zoneOf(W, H), fonts, energy };
  const primary = FACTORY[style.techniques.primary]();
  const secondary = style.techniques.secondary ? FACTORY[style.techniques.secondary]() : null;
  primary.prepare(rc);
  secondary?.prepare(rc);
  const paper = makePaper(style, W, H);
  // V8: маски людей — только если на фото люди; модель не ответила за 6 с — рисуем как раньше.
  const masks = style.visual?.portrait.focusPeople ? await Promise.all(photos.map((p) => personMask(p).catch(() => null))) : [];
  const photoFirst = createPhotoFirst(style, photos, rc.zone, masks);
  const drawing = opts.mode === 'drawing' ? createScene(style, rc.zone, photos) : null;
  // V6: возраст дня на момент просмотра.
  const age = ageEffect(opts.info.date, opts.today ?? localToday());
  const agedStyle: StyleParams = age.grain > 0 ? { ...style, texture: { ...style.texture, grain: Math.min(1, style.texture.grain + age.grain) } } : style;
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const rhythm = (pt: PhotoTime): Rhythm => opts.liveRhythm?.() ?? rhythmFromBeat(pt.beatPhase, energyBase);
  const vis = style.visual;
  const grain = makeGrainTile(style.seed);
  const atmosphere = createAtmosphere(style, W, H);
  const notes = (opts.info.notes ?? []).map((n) => n.trim()).filter(Boolean).slice(0, 4).map((n) => (n.length > 34 ? n.slice(0, 33) + '…' : n));
  const notePlaces = placeNotes(notes.length, style.seed, W, H, LAYOUT.margin, rc.zone, style.typography.captionTilt);
  // Доля второй техники заметна, но не спорит с основной.
  const secondaryAlpha = clamp(style.techniques.mix * 2.2, 0.25, 0.75);

  let raf = 0;
  let startedAt = 0;
  let offset = 0;
  let frame = 0;

  // Слои страницы (по порядку снизу вверх): «Как собран этот день» рисует каждый на своём прозрачном холсте.
  // only — какие слои рисовать (по умолчанию все), g — куда (по умолчанию основной холст).
  function draw(t: number, realtime: boolean, g: CanvasRenderingContext2D = ctx, only?: ReadonlySet<DayLayer>) {
    const on = (l: DayLayer) => !only || only.has(l);
    const prevCtx = rc.ctx;
    rc.ctx = g;
    try { drawInto(t, realtime, g, on); } finally { rc.ctx = prevCtx; }
  }

  function drawInto(t: number, realtime: boolean, g: CanvasRenderingContext2D, on: (l: DayLayer) => boolean) {
    const pt = photoTime(t, style.motion, photos.length);
    g.setTransform(k, 0, 0, k, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    if (on('paper')) g.drawImage(paper, 0, 0);
    const rh = rhythm(pt);
    if (drawing) {
      // Режим «Рисунок»: сцена дня вместо техники; фото — полароидом внутри.
      if (on('technique')) drawing.draw(g, t, pt.index, realtime && !reduced ? rh.beat : 0);
    } else {
      if (on('technique')) {
        primary.drawPhoto(rc, pt, { realtime });
        primary.drawOverlay(rc, pt, 1);
        if (secondary) secondary.drawOverlay(rc, pt, secondaryAlpha);
      }
      // Фото главное: поверх техники — настоящее фото, чёткое, с наездом камеры (техника остаётся фоном и рамкой).
      // V2: бас — кадр дышит (на постере и при «меньше движения» — без дыхания).
      const breath = realtime && !reduced && vis ? vis.rhythm.breath * (rh.bass * 2 - 1) : 0;
      if (on('photo')) photoFirst.draw(g, pt, opts.info.date, { breath, desat: age.desat });
    }
    // Страница собирается на глазах (B5): фото проявляется из бумаги, затем марка, подпись, песня.
    const asm = assemblyAt(t, style.motion, realtime);
    if (asm.photo < 1 && on('paper') && on('photo')) {
      const z = rc.zone, pad = 24;
      g.save();
      g.globalAlpha = 1 - asm.photo;
      g.drawImage(paper, z.x - pad, z.y - pad, z.w + pad * 2, z.h + pad * 2, z.x - pad, z.y - pad, z.w + pad * 2, z.h + pad * 2);
      g.restore();
    }
    // V2: верх спектра — частицы атмосферы мерцают.
    g.save(); g.globalAlpha = realtime && !reduced ? 0.7 + 0.3 * rh.high : 1;
    if (on('atmosphere')) atmosphere.draw(rc, pt);   // слой 3.5: между оверлеем и текстом
    g.restore();
    // V2: удар — короткая вспышка цвета дня.
    if (realtime && !reduced && vis && rh.beat > 0.05 && on('paper') && on('grain')) {
      g.save(); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = vis.rhythm.flash * rh.beat;
      g.fillStyle = style.palette.accents[0] ?? '#ffffff'; g.fillRect(0, 0, W, H); g.restore();
    }
    if (opts.noText) {
      if (on('decor')) drawDecor(g, opts.info.decor, style.palette, fonts, 1, false);
      if (on('grain')) { drawGrain(g, grain, W, H, agedStyle, frame++); drawVignette(g, W, H, 0.12 + 0.2 * style.texture.grain + age.vignette); }
      return;
    }
    if (on('objects')) {
    g.save(); g.globalAlpha = asm.stamps;
    drawStamps(g, W, H, style, fonts);   // марка сезона, штемпель и бирки (план 20.11, B3)
    g.restore();
    g.save(); g.globalAlpha = asm.song;
    drawSongObject(g, W, H, style, fonts, opts.info.songLabel, t, energy(pt));   // песня как предмет (S2)
    g.restore();
    }
    if (on('words')) {
      drawConstants(g, W, H, style, opts.info, fonts, asm.caption);
      drawNotes(g, notes, notePlaces, style, fonts, pt, photos.length, !realtime);
    }
    if (on('decor')) drawDecor(g, opts.info.decor, style.palette, fonts, asm.caption);   // украшения человека (спека 2026-11-20)
    if (on('grain')) {
      drawGrain(g, grain, W, H, agedStyle, frame++);
      drawVignette(g, W, H, 0.12 + 0.2 * style.texture.grain + age.vignette);
    }
  }

  const loop = () => {
    draw(offset + (performance.now() - startedAt) / 1000, true);
    raf = requestAnimationFrame(loop);
  };

  return {
    canvas,
    interval: intervalSec(style.motion),
    renderAt(t) { draw(t, false); },
    renderLayers(t) {
      // В режиме «Рисунок» фото — внутри сцены, отдельного слоя фото нет; без украшений нет и их слоя.
      const ids = DAY_LAYERS.filter((id) => !(id === 'photo' && drawing) && !(id === 'decor' && !opts.info.decor?.items?.length) && !(opts.noText && (id === 'objects' || id === 'words')));
      return ids.map((id) => {
        const c = document.createElement('canvas');
        c.width = canvas.width; c.height = canvas.height;
        draw(t, false, c.getContext('2d')!, new Set([id]));
        return { id, canvas: c };
      });
    },
    play(fromT) {
      cancelAnimationFrame(raf);
      if (fromT !== undefined) offset = fromT;
      startedAt = performance.now();
      raf = requestAnimationFrame(loop);
    },
    pause() {
      cancelAnimationFrame(raf);
      offset += (performance.now() - startedAt) / 1000;
    },
    destroy() { cancelAnimationFrame(raf); },
  };
}
