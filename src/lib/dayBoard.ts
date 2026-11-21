// Доска дня (план 21.11, человек 1): где лежат её фото и как её прочитать вместе с днём.
import type { DayRecord } from './types';
import { boardFilePaths, normalizeBoard, type Board } from './board/board';
import { isUuid, rowToDay, type DayRow } from './db';
import { HttpError } from './http';
import { supabaseAdmin } from './supabase/server';

/** Фото доски дня лежат в своей папке: она не меняется, когда у дня появляется название. */
export const dayBoardFolder = (diaryId: string, dayId: string) => `${diaryId}/_dayboard/${dayId}`;

export async function loadDayBoard(dayId: string): Promise<{ day: DayRecord; board: Board }> {
  if (!isUuid(dayId)) throw new HttpError(404, 'День не найден');
  const { data, error } = await supabaseAdmin().from('days').select('*').eq('id', dayId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'День не найден');
  return { day: rowToDay(data as DayRow), board: normalizeBoard((data as DayRow).board) };
}

/** Чужие фото и голосовые на доске дня запрещены: только из папки этого дня. */
export function assertOwnPhotos(board: Board, day: Pick<DayRecord, 'diaryId' | 'id'>): void {
  const prefix = `${dayBoardFolder(day.diaryId, day.id)}/`;
  if (boardFilePaths(board).some((p) => !p.startsWith(prefix) || p.includes('..'))) throw new HttpError(400, 'Чужой файл на доске');
}
