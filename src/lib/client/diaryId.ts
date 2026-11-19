'use client';
// diaryId в localStorage — это и есть «ключ» к личному дневнику (логина нет).
import { api } from './api';

const KEY = 'atmosphere-diary-id';

export function readDiaryId(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export async function getOrCreateDiaryId(): Promise<string> {
  const existing = readDiaryId();
  if (existing) return existing;
  const { diaryId } = await api.createDiary();
  try { localStorage.setItem(KEY, diaryId); } catch { /* приватный режим: дневник живёт до закрытия вкладки */ }
  return diaryId;
}
