// Правки готового дня человеком (A10): «Не совсем так?» (R10), переименование папки (R11), удаление (R14).
// Всё без нового вызова модели: стиль пересчитывает наш движок правил, анализ дня не меняется.
import { z } from 'zod';
import type { DayRecord, MoodOverride, StyleInput, StyleParams } from './types';
import type { DayRow } from './db';
import { seedFromId } from './generateDay';
import { autoDecor } from './decor/autoDecor';
import { HttpError } from './http';
import { dayFiles, dayFolder, type StoredFile } from './storage';
import { slugify, validateTitle } from './title/validateTitle';

export const MAX_SHIFT = 0.4;

export const MoodOverrideInput = z.object({
  warmth: z.number().min(-MAX_SHIFT).max(MAX_SHIFT),
  energy: z.number().min(-MAX_SHIFT).max(MAX_SHIFT),
});
export const RenameInput = z.object({ title: z.string().min(1).max(120) });

const r2 = (v: number) => Math.round(v * 100) / 100;

export const isZero = (o: MoodOverride) => Math.abs(o.warmth) < 0.005 && Math.abs(o.energy) < 0.005;

/**
 * Новый стиль дня с поправкой. Саму поправку применяет движок B (`StyleInput.moodOverride`) —
 * тот же, что рисует живое превью в браузере, поэтому сохранённое совпадает с увиденным.
 * Ноль → ровно тот стиль, который решила система.
 */
export function restyle(day: DayRecord, o: MoodOverride, buildStyle: (i: StyleInput) => StyleParams): { style: StyleParams; moodOverride: MoodOverride | null } {
  if (day.status !== 'ready' || !day.analysis || !day.music) throw new HttpError(409, 'День ещё не собран');
  const moodOverride = isZero(o) ? null : { warmth: r2(o.warmth), energy: r2(o.energy) };
  const style = buildStyle({
    analysis: day.analysis, photos: day.photos.map((p) => p.features), music: day.music, date: day.date,
    seed: seedFromId(day.id), moodOverride, weather: day.weather ?? null,
  });
  // Причина авто-стикеров живёт в стиле: после пересчёта возвращаем её, если человек их не трогал.
  if (day.decor?.source === 'auto' && day.decor.items.length) {
    style.reasons = [...style.reasons, { param: 'decor', because: autoDecor(day.analysis, day.text, seedFromId(day.id)).because }];
  }
  return { style, moodOverride };
}

export const dayText = (title: string, date: string, text: string) => `# ${title}\n\n${date}\n\n${text}\n`;

export interface RenameDeps {
  slugTaken(diaryId: string, slug: string, date: string, exceptId: string): Promise<boolean>;
  listFolder(folder: string): Promise<StoredFile[]>;
  moveFile(from: string, to: string): Promise<void>;
  putFile(path: string, body: string, contentType: string): Promise<void>;
  updateDay(id: string, patch: Partial<DayRow>): Promise<DayRecord>;
}

/** Переименование: новое название по тем же правилам, папка в Storage переезжает целиком. */
export async function renameDay(day: DayRecord, rawTitle: string, deps: RenameDeps): Promise<DayRecord> {
  if (day.status !== 'ready' || !day.slug) throw new HttpError(409, 'День ещё не собран');
  const check = validateTitle(rawTitle);
  if (!check.ok) throw new HttpError(400, `Название: ${check.reason}. Нужно 3–7 слов`);
  const title = check.title;
  if (title === day.title) return day;

  const base = slugify(title);
  let slug = base;
  for (let n = 2; slug !== day.slug && await deps.slugTaken(day.diaryId, slug, day.date, day.id); n++) slug = `${base}-${n}`;

  const from = dayFolder(day.diaryId, day.date, day.slug, day.id);
  const to = dayFolder(day.diaryId, day.date, slug, day.id);
  const re = (p: string) => (p.startsWith(from + '/') ? to + p.slice(from.length) : p);
  if (from !== to) {
    for (const f of await deps.listFolder(from)) await deps.moveFile(f.path, re(f.path));
  }
  await deps.putFile(dayFiles(to).text, dayText(title, day.date, day.text), 'text/markdown; charset=utf-8');

  return deps.updateDay(day.id, {
    title, slug,
    photos: day.photos.map(({ path, thumbPath, features }) => ({ path: re(path), thumbPath: re(thumbPath), features })),
    song: day.song.kind === 'file' && day.song.path ? { ...day.song, path: re(day.song.path) } : day.song,
    poster_path: day.posterPath ? re(day.posterPath) : null,
    voice: day.voice ? { path: re(day.voice.path), preset: day.voice.preset } : null,
  });
}

export interface DeleteDeps {
  listFolder(folder: string): Promise<StoredFile[]>;
  removeFiles(paths: string[]): Promise<void>;
  deleteRow(id: string): Promise<void>;
}

/** Удаление дня: все файлы папки (и черновика, если остался) и строка в БД. */
export async function deleteDay(day: DayRecord, deps: DeleteDeps): Promise<void> {
  const folders = [dayFolder(day.diaryId, day.date, null, day.id)];
  if (day.slug) folders.unshift(dayFolder(day.diaryId, day.date, day.slug, day.id));
  const files = (await Promise.all(folders.map((f) => deps.listFolder(f).catch(() => [])))).flat().map((f) => f.path);
  if (files.length) await deps.removeFiles(files);
  await deps.deleteRow(day.id);
}
