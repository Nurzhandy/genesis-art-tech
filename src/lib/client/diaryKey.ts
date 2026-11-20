'use client';
// Ключ дневника в localStorage (логина нет): кто знает id дневника, тот его владелец (A2, A10 / R7).
// Чтение через useSyncExternalStore: на сервере значения нет (undefined), в браузере — актуальное.
import { useMemo, useSyncExternalStore } from 'react';
import { migrateShelf } from '@/lib/shelf';

const KEY = 'atmosphere-diary-id';
const SAVED = 'atmosphere-diary-key-saved';
/** Полка: ключи всех дневников этого устройства (спека 2026-11-20). Старый одиночный ключ переезжает сюда. */
const SHELF = 'atmosphere-shelf';

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

export const readShelf = (): string[] => migrateShelf(read(SHELF), read(KEY));
export function addToShelf(id: string): void {
  const list = readShelf();
  writeStored(SHELF, JSON.stringify(list.includes(id) ? list : [...list, id]));
}
export function removeFromShelf(id: string): void {
  writeStored(SHELF, JSON.stringify(readShelf().filter((x) => x !== id)));
  if (read(KEY) === id) { try { localStorage.removeItem(KEY); } catch { /* не критично */ } listeners.forEach((l) => l()); }
}
/** Полка как React-состояние; undefined — ещё на сервере. */
export function useShelf(): string[] | undefined {
  const raw = useStored(SHELF);
  const legacy = useStored(KEY);
  return useMemo(() => (raw === undefined || legacy === undefined ? undefined : migrateShelf(raw, legacy)), [raw, legacy]);
}

/** Первый дневник полки — для старых мест, где нужен «мой дневник». */
export const readDiaryId = (): string | null => readShelf()[0] ?? null;
export const rememberDiaryId = (id: string): void => addToShelf(id);
export function useMyDiaryId(): string | null | undefined {
  const shelf = useShelf();
  return shelf === undefined ? undefined : shelf[0] ?? null;
}
/** Это дневник этого устройства (есть на полке)? На сервере всегда false. */
export function useIsMyDiary(id: string): boolean {
  const shelf = useShelf();
  return !!shelf?.includes(id);
}
/** Заголовок владельца: все ключи полки, сервер ищет среди них ключ нужного дневника. */
export function ownerHeaders(): Record<string, string> {
  const keys = readShelf();
  return keys.length ? { 'x-diary-key': keys.join(',') } : {};
}

/** Человек уже сохранил ссылку-ключ (или закрыл напоминание) — плашку больше не показываем. */
export const useKeySaved = (id: string): boolean | undefined => {
  const v = useStored(SAVED);
  return v === undefined ? undefined : v === id;
};
export const markKeySaved = (id: string): void => writeStored(SAVED, id);

export const diaryLink = (id: string): string => `${window.location.origin}/diary/${id}`;
