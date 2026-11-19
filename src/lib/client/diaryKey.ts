'use client';
// Ключ дневника в localStorage (логина нет): кто знает id дневника, тот его владелец (A2, A10 / R7).
// Чтение через useSyncExternalStore: на сервере значения нет (undefined), в браузере — актуальное.
import { useSyncExternalStore } from 'react';

const KEY = 'atmosphere-diary-id';
const SAVED = 'atmosphere-diary-key-saved';

const listeners = new Set<() => void>();

function read(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
export function writeStored(k: string, v: string): void {
  try { localStorage.setItem(k, v); } catch { /* приватный режим: значение живёт до закрытия вкладки */ }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => { listeners.delete(cb); window.removeEventListener('storage', cb); };
}

/** Значение из localStorage как React-состояние. undefined — ещё на сервере / до гидрации. */
export function useStored(k: string): string | null | undefined {
  return useSyncExternalStore(subscribe, () => read(k), () => undefined);
}

export const readDiaryId = (): string | null => read(KEY);
export const rememberDiaryId = (id: string): void => writeStored(KEY, id);
export const useMyDiaryId = () => useStored(KEY);
/** Это дневник этого устройства? На сервере всегда false. */
export const useIsMyDiary = (id: string): boolean => useStored(KEY) === id;

/** Человек уже сохранил ссылку-ключ (или закрыл напоминание) — плашку больше не показываем. */
export const useKeySaved = (id: string): boolean | undefined => {
  const v = useStored(SAVED);
  return v === undefined ? undefined : v === id;
};
export const markKeySaved = (id: string): void => writeStored(SAVED, id);

export const diaryLink = (id: string): string => `${window.location.origin}/diary/${id}`;
