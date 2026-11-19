// Постер дня: кадр в момент 40% первого фото, JPEG 1080×1920 (B8). PNG весил ~5 МБ — архив грузился медленно.
import type { Engine } from './engine';

export async function exportPoster(engine: Engine): Promise<Blob> {
  engine.renderAt(engine.interval * 0.4);
  return new Promise((res, rej) => engine.canvas.toBlob((b) => (b ? res(b) : rej(new Error('Не удалось сохранить постер'))), 'image/jpeg', 0.88));
}
