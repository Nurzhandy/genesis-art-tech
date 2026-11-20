'use client';
// Три главных цвета обложки альбома (план 20.11, #2) — для палитры дня.
import { coverProxyUrl, isAllowedCoverUrl } from '@/lib/music/cover';
import { computeFeatures } from './photoFeatures';

export async function extractCoverPalette(coverUrl: string | undefined): Promise<string[] | undefined> {
  if (!coverUrl || !isAllowedCoverUrl(coverUrl)) return undefined;
  try {
    const blob = await fetch(coverProxyUrl(coverUrl)).then((r) => (r.ok ? r.blob() : Promise.reject()));
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = 96; c.height = 96;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(bmp, 0, 0, 96, 96);
    bmp.close();
    return computeFeatures(g.getImageData(0, 0, 96, 96).data, 96, 96, 0, 3).palette.slice(0, 3);
  } catch {
    return undefined;
  }
}
