// Постер дня: кадр в момент 40% первого фото, PNG 1080×1920 (B8).
import type { Engine } from './engine';

export async function exportPoster(engine: Engine): Promise<Blob> {
  engine.renderAt(engine.interval * 0.4);
  return new Promise((res, rej) => engine.canvas.toBlob((b) => (b ? res(b) : rej(new Error('Не удалось сохранить постер'))), 'image/png'));
}
