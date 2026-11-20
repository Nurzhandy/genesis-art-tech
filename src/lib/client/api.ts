'use client';
// Обёртки над нашим API для браузера.
import { createClient } from '@supabase/supabase-js';
import type { DayRecord, MoodOverride, MusicFeatures, PhotoFeatures, SongRef, VoicePreset } from '@/lib/types';
import type { UploadFile } from '@/lib/validation';
import { readDiaryId } from './diaryKey';

export interface SignedUpload { kind: UploadFile['kind']; index?: number; path: string; token: string; signedUrl: string }

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Ошибка ${res.status}`);
  return body as T;
}

let storage: ReturnType<typeof createClient> | null = null;
function anon() {
  storage ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  return storage;
}

export type NewSong = SongRef extends infer S ? (S extends { kind: 'file' } ? { kind: 'file'; ext?: string; title?: string; artist?: string } : S) : never;

export const api = {
  createDiary: () => call<{ diaryId: string }>('/api/diaries', { method: 'POST' }),
  listDays: (diaryId: string, q = '', songs: string[] = []) => {
    const params = new URLSearchParams([...(q ? [['q', q]] : []), ...songs.map((s) => ['song', s])]).toString();
    return call<DayRecord[]>(`/api/diaries/${diaryId}/days${params ? `?${params}` : ''}`);
  },
  createDay: (diaryId: string, body: { date: string; text: string; photoCount: number; song: NewSong; place?: string; sealedUntil?: string }) =>
    call<{ dayId: string }>(`/api/diaries/${diaryId}/days`, { method: 'POST', body: JSON.stringify(body) }),
  getDay: (dayId: string) => call<DayRecord>(`/api/days/${dayId}`),
  requestUploads: (dayId: string, files: UploadFile[]) =>
    call<{ uploads: SignedUpload[] }>(`/api/days/${dayId}/uploads`, { method: 'POST', body: JSON.stringify({ files }) }),
  async uploadFile(u: SignedUpload, blob: Blob) {
    const { error } = await anon().storage.from('days').uploadToSignedUrl(u.path, u.token, blob, { contentType: blob.type || undefined });
    if (error) throw new Error('Не удалось загрузить файл: ' + error.message);
  },
  generate: (dayId: string, body: { photoFeatures: PhotoFeatures[]; music: MusicFeatures | null; coverPalette?: string[]; photoHour?: number }) =>
    call<DayRecord>(`/api/days/${dayId}/generate`, { method: 'POST', body: JSON.stringify(body) }),
  voice: (dayId: string) => call<{ url: string | null; preset: VoicePreset }>(`/api/days/${dayId}/voice`, { method: 'POST' }),
  resolveSong: (url: string) =>
    call<{ song: SongRef; music: MusicFeatures | null }>(`/api/music/resolve?url=${encodeURIComponent(url)}`),
  files: (dayId: string) => call<{ folder: string; files: { name: string; size: number }[] }>(`/api/days/${dayId}/files`),

  // Правки дня: только владелец. Ключ дневника этого устройства (localStorage) идёт в заголовке.
  // restyle (R10): сохраняет поправку и пересчитанный style, сбрасывает постер.
  restyle: (dayId: string, override: MoodOverride) =>
    call<DayRecord>(`/api/days/${dayId}/restyle`, { method: 'POST', headers: owner(), body: JSON.stringify(override) }),
  rename: (dayId: string, title: string) =>
    call<DayRecord>(`/api/days/${dayId}`, { method: 'PATCH', headers: owner(), body: JSON.stringify({ title }) }),
  // Ссылка-подарок (план 20.11, A4).
  share: (dayId: string) => call<{ shareId: string; path: string }>(`/api/days/${dayId}/share`, { method: 'POST', headers: owner() }),
  async unshare(dayId: string) {
    const res = await fetch(`/api/days/${dayId}/share`, { method: 'DELETE', headers: owner() });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Ошибка ${res.status}`);
  },
  async deleteDay(dayId: string) {
    const res = await fetch(`/api/days/${dayId}`, { method: 'DELETE', headers: owner() });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Ошибка ${res.status}`);
  },
};

function owner(): Record<string, string> {
  const key = readDiaryId();
  return key ? { 'x-diary-key': key } : {};
}
