'use client';
// diaryId в localStorage — это и есть «ключ» к личному дневнику (логина нет).
import { api } from './api';
import { readDiaryId, rememberDiaryId } from './diaryKey';

export { readDiaryId } from './diaryKey';

export async function getOrCreateDiaryId(): Promise<string> {
  const existing = readDiaryId();
  if (existing) return existing;
  const { diaryId } = await api.createDiary();
  rememberDiaryId(diaryId);
  return diaryId;
}
