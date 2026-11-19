'use client';
// Обёртки над нашим API для браузера.
import { createClient } from '@supabase/supabase-js';
import type { DayRecord, MoodOverride, MusicFeatures, PhotoFeatures, SongRef, VoicePreset } from '@/lib/types';
import type { UploadFile } from '@/lib/validation';

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
  listDays: (diaryId: string, q = '') =>
    call<DayRecord[]>(`/api/diaries/${diaryId}/days${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createDay: (diaryId: string, body: { date: string; text: string; photoCount: number; song: NewSong }) =>
    call<{ dayId: string }>(`/api/diaries/${diaryId}/days`, { method: 'POST', body: JSON.stringify(body) }),
  getDay: (dayId: string) => call<DayRecord>(`/api/days/${dayId}`),
  requestUploads: (dayId: string, files: UploadFile[]) =>
    call<{ uploads: SignedUpload[] }>(`/api/days/${dayId}/uploads`, { method: 'POST', body: JSON.stringify({ files }) }),
  async uploadFile(u: SignedUpload, blob: Blob) {
    const { error } = await anon().storage.from('days').uploadToSignedUrl(u.path, u.token, blob, { contentType: blob.type || undefined });
    if (error) throw new Error('Не удалось загрузить файл: ' + error.message);
  },
  generate: (dayId: string, body: { photoFeatures: PhotoFeatures[]; music: MusicFeatures | null }) =>
    call<DayRecord>(`/api/days/${dayId}/generate`, { method: 'POST', body: JSON.stringify(body) }),
  // Эндпоинт — часть A (ресерч R10): сохраняет поправку и пересчитанный style, сбрасывает постер.
  restyle: (dayId: string, moodOverride: MoodOverride) =>
    call<DayRecord>(`/api/days/${dayId}/restyle`, { method: 'POST', body: JSON.stringify(moodOverride) }),
  voice: (dayId: string) => call<{ url: string | null; preset: VoicePreset }>(`/api/days/${dayId}/voice`, { method: 'POST' }),
  resolveSong: (url: string) =>
    call<{ song: SongRef; music: MusicFeatures | null }>(`/api/music/resolve?url=${encodeURIComponent(url)}`),
};
