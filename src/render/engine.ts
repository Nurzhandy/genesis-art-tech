// Движок воспоминания: фото + стиль → живой холст 9:16 (B2, B7).
import type { StyleParams, Technique } from '@/lib/types';
import { LAYOUT } from '@/lib/style/constants';
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
}

export interface Engine {
  renderAt(t: number): void;
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
  img.src = url;
  await img.decode();
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

export async function createEngine(canvas: HTMLCanvasElement, opts: EngineOptions): Promise<Engine> {
  const W = LAYOUT.width, H = LAYOUT.height;
  const lowPower = typeof window !== 'undefined' && window.innerWidth < 500 && window.devicePixelRatio > 2;
  const k = lowPower ? 0.5 : 1;
  canvas.width = W * k;
  canvas.height = H * k;
  const ctx = canvas.getContext('2d')!;

  const [photos, fonts] = await Promise.all([Promise.all(opts.photoUrls.map(loadImage)), loadFonts()]);
  if (!photos.length) throw new Error('Нет фото для воспоминания');

  const style: StyleParams = opts.overrideTechnique
    ? { ...opts.style, techniques: { ...opts.style.techniques, ...opts.overrideTechnique } }
    : opts.style;
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
  const grain = makeGrainTile(style.seed);
  // Доля второй техники заметна, но не спорит с основной.
  const secondaryAlpha = clamp(style.techniques.mix * 2.2, 0.25, 0.75);

  let raf = 0;
  let startedAt = 0;
  let offset = 0;
  let frame = 0;

  function draw(t: number, realtime: boolean) {
    const pt = photoTime(t, style.motion, photos.length);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(paper, 0, 0);
    primary.drawPhoto(rc, pt, { realtime });
    primary.drawOverlay(rc, pt, 1);
    if (secondary) secondary.drawOverlay(rc, pt, secondaryAlpha);
    drawConstants(ctx, W, H, style, opts.info, fonts);
    drawGrain(ctx, grain, W, H, style, frame++);
    drawVignette(ctx, W, H, 0.12 + 0.2 * style.texture.grain);
  }

  const loop = () => {
    draw(offset + (performance.now() - startedAt) / 1000, true);
    raf = requestAnimationFrame(loop);
  };

  return {
    canvas,
    interval: intervalSec(style.motion),
    renderAt(t) { draw(t, false); },
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
