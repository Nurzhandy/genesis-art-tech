// Сборка дня из доски (план 21.11, человек 1): доска → поля дня → фото в слоты дня → прежний generateDay.
// Повторная сборка: если день уже собран, старые файлы фото убираем и собираем заново (лимит в сутки тот же).
import type { DayRecord } from './types';
import type { Board } from './board/board';
import { collectDay } from './board/collect';
import type { DayRow } from './db';
import { HttpError } from './http';
import { dayFiles, dayFolder } from './storage';
import type { AssembleBody, GenerateBody } from './validation';
import { ownVoicePreset } from './voice/ownVoice';

export interface AssembleDeps {
  load(dayId: string): Promise<{ day: DayRecord; board: Board }>;
  updateDay(id: string, patch: Partial<DayRow>): Promise<DayRecord>;
  copyFile(from: string, to: string): Promise<void>;
  removeFiles(paths: string[]): Promise<void>;
  generate(dayId: string, body: GenerateBody): Promise<DayRecord>;
  /** Лимит сборок проверяем до того, как трогать файлы: иначе пересборка сотрёт старый день и упрётся в лимит. */
  limitReached(diaryId: string): Promise<boolean>;
}

export async function assembleDay(dayId: string, body: AssembleBody, deps: AssembleDeps, assertOwner: (day: DayRecord) => void): Promise<DayRecord> {
  const { day, board } = await deps.load(dayId);
  assertOwner(day);
  if (day.status === 'generating') throw new HttpError(409, 'День уже собирается');

  let got;
  try { got = collectDay(board); } catch (e) { throw new HttpError(400, e instanceof Error ? e.message : 'Доска пустая'); }
  if (body.photoFeatures.length !== got.photoPaths.length) {
    throw new HttpError(400, `Признаков фото ${body.photoFeatures.length}, а фото на доске ${got.photoPaths.length}`);
  }

  if (await deps.limitReached(day.diaryId)) throw new HttpError(429, 'Лимит на сегодня исчерпан');

  // Пересборка: убираем файлы прошлой сборки (фото доски остаются на месте — они в своей папке).
  const old = [...day.photos.flatMap((p) => [p.path, p.thumbPath]), day.posterPath].filter((p): p is string => !!p);
  const draft = dayFiles(dayFolder(day.diaryId, day.date, null, day.id));
  const slots = got.photoPaths.flatMap((_, i) => [draft.photo(i), draft.thumb(i)]);
  await deps.removeFiles([...new Set([...old, ...slots])]).catch(() => undefined);

  // Фото доски → слоты черновика. Миниатюра для анализа — та же картинка (на доске она уже сжата).
  for (const [i, path] of got.photoPaths.entries()) {
    await deps.copyFile(path, draft.photo(i));
    await deps.copyFile(path, draft.thumb(i));
  }

  await deps.updateDay(day.id, {
    status: 'draft', error: null, photos: [], poster_path: null,
    text: got.text, song: got.song, feeling: got.feeling ?? null, decor: got.decor,
    // Голосовое с доски — голос дня: плеер играет его, а не синтез. Без голосового сбрасываем старую озвучку:
    // текст дня мог поменяться, синтез соберётся заново по новому тексту.
    voice: got.voicePath ? { path: got.voicePath, preset: ownVoicePreset() } : null,
    ...(body.date ? { date: body.date } : {}),
    ...(body.place !== undefined ? { place: body.place || null } : {}),
  });

  return deps.generate(day.id, {
    photoFeatures: body.photoFeatures.map((f, i) => ({ ...f, index: i })),
    music: body.music, coverPalette: body.coverPalette, photoHour: body.photoHour,
  });
}
