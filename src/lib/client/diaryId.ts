'use client';
// diaryId в localStorage — это и есть «ключ» к личному дневнику (логина нет).
import { api } from './api';
import { addToShelf, readDiaryId } from './diaryKey';

export { readDiaryId } from './diaryKey';

export async function getOrCreateDiaryId(): Promise<string> {
  const existing = readDiaryId();
  if (existing) return existing;
  const { diaryId } = await api.createDiary();
  addToShelf(diaryId);
  return diaryId;
}

/** Новый дневник на полке (спека 2026-11-20). */
export async function createShelfDiary(title: string, kind: import('@/lib/shelf').DiaryKind): Promise<string> {
  const { diaryId } = await api.createDiary({ title, kind });
  addToShelf(diaryId);
  return diaryId;
}
