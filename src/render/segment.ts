'use client';
// V8: маска людей на фото (MediaPipe Image Segmenter, модель selfie_multiclass), считается один раз на фото.
// Нет сети, WebGL/WASM или модель не успела за 6 с — возвращаем null, и страница выглядит как раньше.
import type { RenderPhoto } from './types';

const VERSION = '1.2.2';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';
const MAX_SIDE = 512;

type Segmenter = { segment(img: CanvasImageSource): { confidenceMasks?: { width: number; height: number; getAsFloat32Array(): Float32Array; close(): void }[] } };
let segmenter: Promise<Segmenter | null> | null = null;
const cache = new WeakMap<CanvasImageSource, Promise<HTMLCanvasElement | null>>();

function load(): Promise<Segmenter | null> {
  segmenter ??= (async () => {
    try {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks(WASM);
      return (await ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
        runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false,
      })) as unknown as Segmenter;
    } catch (e) {
      console.warn('segment: модель людей не загрузилась, рисуем без неё', e);
      return null;
    }
  })();
  return segmenter;
}

const timeout = <T,>(p: Promise<T>, ms: number, fallback: T) => Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

/** Маска людей размером фото (уменьшенного до 512 px): альфа = уверенность, что тут человек. */
export function personMask(photo: RenderPhoto): Promise<HTMLCanvasElement | null> {
  const hit = cache.get(photo.img);
  if (hit) return hit;
  const job = timeout((async () => {
    const seg = await load();
    if (!seg) return null;
    const k = Math.min(1, MAX_SIDE / Math.max(photo.w, photo.h));
    const src = document.createElement('canvas');
    src.width = Math.max(1, Math.round(photo.w * k)); src.height = Math.max(1, Math.round(photo.h * k));
    src.getContext('2d')!.drawImage(photo.img, 0, 0, src.width, src.height);
    const res = seg.segment(src);
    const bg = res.confidenceMasks?.[0];   // категория 0 — фон; человек = 1 − фон
    if (!bg) return null;
    const data = bg.getAsFloat32Array();
    const out = document.createElement('canvas');
    out.width = bg.width; out.height = bg.height;
    const g = out.getContext('2d')!;
    const img = g.createImageData(bg.width, bg.height);
    let people = 0;
    for (let i = 0; i < data.length; i++) {
      const a = Math.max(0, Math.min(1, (1 - data[i] - 0.15) / 0.7));   // мягкий край
      img.data[i * 4 + 3] = Math.round(a * 255);
      if (a > 0.5) people++;
    }
    res.confidenceMasks?.forEach((m) => m.close());
    if (people < data.length * 0.02) return null;   // людей почти нет — маска не нужна
    g.putImageData(img, 0, 0);
    return out;
  })().catch(() => null), 6000, null);
  cache.set(photo.img, job);
  return job;
}
