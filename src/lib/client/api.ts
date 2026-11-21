'use client';
// Обёртки над нашим API для браузера.
import type { DayRecord, MoodOverride, MusicFeatures, PhotoFeatures, SongRef, VoicePreset } from '@/lib/types';
import type { UploadFile } from '@/lib/validation';
import type { DiaryKind, DiaryMeta } from '@/lib/shelf';
import type { Decor } from '@/lib/decor/decor';
import type { Board } from '@/lib/board/board';
import { ownerHeaders } from './diaryKey';
import { authHeaders } from './auth';
import { browserSupabase } from './supabase';

export interface SignedUpload { kind: UploadFile['kind']; index?: number; path: string; token: string; signedUrl: string }

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Ошибка ${res.status}`);
  return body as T;
}

// Один клиент Supabase на браузер: тот же, что держит вход (иначе два клиента спорят за сессию).
function anon() {
  const sb = browserSupabase();
  if (!sb) throw new Error('Хранилище не подключено: нет ключей Supabase');
  return sb;
}

export type NewSong = SongRef extends infer S ? (S extends { kind: 'file' } ? { kind: 'file'; ext?: string; title?: string; artist?: string } : S) : never;

export const api = {
  createDiary: (body?: { title: string; kind: DiaryKind }) =>
    // Дневник заводится только после входа (план 21.11, часть A): токен говорит серверу, чей он.
    call<{ diaryId: string }>('/api/diaries', { method: 'POST', headers: authHeaders(), body: JSON.stringify(body ?? {}) }),
  // Полка (спека 2026-11-20): карточки дневников этого устройства, переименование.
  shelf: (ids: string[]) => call<DiaryMeta[]>(`/api/diaries?ids=${encodeURIComponent(ids.slice(0, 50).join(','))}`),
  diary: (id: string) => call<DiaryMeta>(`/api/diaries/${id}`),
  renameDiary: (id: string, title: string) =>
    call<DiaryMeta>(`/api/diaries/${id}`, { method: 'PATCH', headers: owner(), body: JSON.stringify({ title }) }),
  listDays: (diaryId: string, q = '', songs: string[] = []) => {
    const params = new URLSearchParams([...(q ? [['q', q]] : []), ...songs.map((s) => ['song', s])]).toString();
    return call<DayRecord[]>(`/api/diaries/${diaryId}/days${params ? `?${params}` : ''}`);
  },
  createDay: (diaryId: string, body: { date: string; text: string; photoCount: number; song: NewSong; place?: string; sealedUntil?: string; feeling?: string }) =>
    call<{ dayId: string }>(`/api/diaries/${diaryId}/days`, { method: 'POST', body: JSON.stringify(body) }),
  getDay: (dayId: string) => call<DayRecord>(`/api/days/${dayId}`),
  requestUploads: (dayId: string, files: UploadFile[]) =>
    call<{ uploads: SignedUpload[] }>(`/api/days/${dayId}/uploads`, { method: 'POST', headers: owner(), body: JSON.stringify({ files }) }),
  async uploadFile(u: SignedUpload, blob: Blob) {
    // Локальный режим (нет ключей Supabase): сервер выдал ссылку на свой маршрут — кладём файл туда.
    if (u.signedUrl.startsWith('/api/local/')) {
      const res = await fetch(u.signedUrl, { method: 'PUT', body: blob, headers: { 'content-type': blob.type || 'application/octet-stream' } });
      if (!res.ok) throw new Error('Не удалось загрузить файл');
      return;
    }
    const { error } = await anon().storage.from('days').uploadToSignedUrl(u.path, u.token, blob, { contentType: blob.type || undefined });
    if (error) throw new Error('Не удалось загрузить файл: ' + error.message);
  },
  generate: (dayId: string, body: { photoFeatures: PhotoFeatures[]; music: MusicFeatures | null; coverPalette?: string[]; photoHour?: number }) =>
    call<DayRecord>(`/api/days/${dayId}/generate`, { method: 'POST', body: JSON.stringify(body) }),
  voice: (dayId: string) => call<{ url: string | null; preset: VoicePreset }>(`/api/days/${dayId}/voice`, { method: 'POST' }),
  // «Рассказать день»: голос (base64) и/или расшифровка браузера → запись дня.
  story: (body: { audio?: string; mime?: string; transcript?: string }) =>
    call<{ transcript: string; entry: string; place: string | null; song: string | null; songUrl: string | null; details: string[]; source: 'ai' | 'local' }>(
      '/api/story', { method: 'POST', body: JSON.stringify(body) }),
  resolveSong: (url: string) =>
    call<{ song: SongRef; music: MusicFeatures | null }>(`/api/music/resolve?url=${encodeURIComponent(url)}`),
  files: (dayId: string) => call<{ folder: string; files: { name: string; size: number }[] }>(`/api/days/${dayId}/files`),

  // Правки дня: только владелец. Ключ дневника этого устройства (localStorage) идёт в заголовке.
  // restyle (R10): сохраняет поправку и пересчитанный style, сбрасывает постер.
  restyle: (dayId: string, override: MoodOverride) =>
    call<DayRecord>(`/api/days/${dayId}/restyle`, { method: 'POST', headers: owner(), body: JSON.stringify(override) }),
  rename: (dayId: string, title: string) =>
    call<DayRecord>(`/api/days/${dayId}`, { method: 'PATCH', headers: owner(), body: JSON.stringify({ title }) }),
  // Свободная доска дневника (новая концепция 20.11).
  board: (diaryId: string) => call<{ board: Board; urls: Record<string, string> }>(`/api/diaries/${diaryId}/board`),
  saveBoard: (diaryId: string, board: Board) =>
    call<{ ok: true }>(`/api/diaries/${diaryId}/board`, { method: 'PUT', headers: owner(), body: JSON.stringify(board) }),
  /** ext — для голосового (webm, ogg, m4a, mp3, wav); без него — фото. */
  boardUpload: (diaryId: string, ext?: string) =>
    call<{ path: string; token: string; signedUrl: string; readUrl: string | null }>(`/api/diaries/${diaryId}/board/upload${ext ? `?ext=${ext}` : ''}`, { method: 'POST', headers: owner() }),
  // ── Доска дня (план 21.11): «＋ день» → черновик → доска → «Собрать день» ──
  createDraftDay: (diaryId: string, date: string, place?: string) =>
    call<{ dayId: string }>(`/api/diaries/${diaryId}/days`, { method: 'POST', headers: { 'content-type': 'application/json', ...owner() }, body: JSON.stringify({ draft: true, date, ...(place ? { place } : {}) }) }),
  dayBoard: (dayId: string) =>
    call<{ board: Board; urls: Record<string, string>; day: { id: string; diaryId: string; date: string; place: string | null; status: DayRecord['status']; title: string | null } }>(`/api/days/${dayId}/board`),
  saveDayBoard: (dayId: string, board: Board) =>
    call<{ ok: true }>(`/api/days/${dayId}/board`, { method: 'PUT', headers: owner(), body: JSON.stringify(board) }),
  dayBoardUpload: (dayId: string, ext?: string) =>
    call<{ path: string; token: string; signedUrl: string; readUrl: string | null }>(`/api/days/${dayId}/board/upload${ext ? `?ext=${ext}` : ''}`, { method: 'POST', headers: owner() }),
  /** photoFeatures — в порядке фото доски (сверху вниз, слева направо, первые 5): см. collectDay. */
  assembleDay: (dayId: string, body: { photoFeatures: PhotoFeatures[]; music?: MusicFeatures | null; coverPalette?: string[]; photoHour?: number; date?: string; place?: string }) =>
    call<DayRecord>(`/api/days/${dayId}/assemble`, { method: 'POST', headers: { 'content-type': 'application/json', ...owner() }, body: JSON.stringify(body) }),
  // Украшения страницы (спека 2026-11-20): только владелец.
  saveDecor: (dayId: string, decor: Decor) =>
    call<DayRecord>(`/api/days/${dayId}/decor`, { method: 'PUT', headers: owner(), body: JSON.stringify(decor) }),
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

const owner = ownerHeaders;
