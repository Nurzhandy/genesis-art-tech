'use client';
// Подготовка фото в браузере: HEIC → JPEG, поворот по EXIF, 1600px + превью 768px, признаки (A4).
import type { PhotoFeatures } from '@/lib/types';
import { exifDateTime } from './exif';
import { computeFeatures } from './photoFeatures';

export interface ProcessedPhoto { full: Blob; thumb: Blob; preview: string; features: PhotoFeatures; takenAt: string | null }

const isHeic = (f: File) => /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

async function toBitmap(file: File): Promise<ImageBitmap> {
  let blob: Blob = file;
  if (isHeic(file)) {
    try {
      const heic2any = (await import('heic2any')).default;
      const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      blob = Array.isArray(out) ? out[0] : out;
    } catch {
      throw new Error('Не получилось открыть фото HEIC — сохраните его как JPEG');
    }
  }
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`Не получилось открыть «${file.name}». Подойдут JPEG, PNG, WebP или HEIC.`);
  }
}

function resize(bmp: ImageBitmap, maxSide: number): HTMLCanvasElement {
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

const toBlob = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Не удалось сжать фото'))), 'image/jpeg', q));

/** Время съёмки из EXIF (план 20.11, A2): он в начале JPEG, хватает первых 256 КБ. */
async function readTakenAt(file: File): Promise<string | null> {
  if (isHeic(file)) return null;
  try { return exifDateTime(await file.slice(0, 256 * 1024).arrayBuffer()); } catch { return null; }
}

export async function processPhoto(file: File, index: number): Promise<ProcessedPhoto> {
  const takenAt = await readTakenAt(file);
  const bmp = await toBitmap(file);
  const fullCanvas = resize(bmp, 1600);
  const thumbCanvas = resize(bmp, 768);
  const small = resize(bmp, 200);
  bmp.close();
  const px = small.getContext('2d')!.getImageData(0, 0, small.width, small.height).data;
  const features = { ...computeFeatures(px, small.width, small.height, index), width: fullCanvas.width, height: fullCanvas.height };
  const [full, thumb] = await Promise.all([toBlob(fullCanvas, 0.85), toBlob(thumbCanvas, 0.8)]);
  return { full, thumb, preview: URL.createObjectURL(thumb), features, takenAt };
}
