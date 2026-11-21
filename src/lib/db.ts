// Доступ к таблице days и превращение строк в DayRecord с signed URLs.
import type { DayRecord, DayStatus } from './types';
import { HttpError } from './http';
import { normalizeDecor } from './decor/decor';
import { signRead } from './storage';
import { supabaseAdmin } from './supabase/server';

export interface DayRow {
  id: string; diary_id: string; date: string; title: string | null; slug: string | null; text: string;
  photos: DayRecord['photos']; song: DayRecord['song']; music: DayRecord['music'];
  analysis: DayRecord['analysis']; style: DayRecord['style']; voice: DayRecord['voice'];
  poster_path: string | null; status: DayStatus; error: string | null; created_at: string;
  mood_override?: DayRecord['moodOverride'];   // колонка из миграции 0002
  place?: string | null;                       // колонки из миграции 0003 (план 20.11, часть A)
  weather?: DayRecord['weather'];
  sealed_until?: string | null;
  share_id?: string | null;
  decor?: unknown;                             // миграция 0004
  feeling?: string | null;                     // миграция 0006
}

export function rowToDay(r: DayRow): DayRecord {
  return {
    id: r.id, diaryId: r.diary_id, date: r.date, title: r.title, slug: r.slug, text: r.text,
    photos: r.photos ?? [], song: r.song, music: r.music, analysis: r.analysis, style: r.style, voice: r.voice,
    posterPath: r.poster_path, status: r.status, error: r.error, createdAt: r.created_at,
    moodOverride: r.mood_override ?? null,
    place: r.place ?? null, weather: r.weather ?? null,
    sealedUntil: r.sealed_until ?? null, shareId: r.share_id ?? null,
    decor: r.decor ? normalizeDecor(r.decor) : null,
    feeling: r.feeling ?? null,
  };
}

export const demoDiaryId = () => process.env.DEMO_DIARY_ID ?? 'demo';

/** Заголовок, которым браузер доказывает, что это его дневник (diaryId из localStorage). */
export const DIARY_KEY_HEADER = 'x-diary-key';

/**
 * Менять и удалять день может только владелец дневника: ключ дневника приходит в заголовке.
 * Демо-дневник только для просмотра.
 */
export function assertCanEdit(req: Request, day: DayRecord): void {
  if (day.diaryId === demoDiaryId() && process.env.ALLOW_DEMO_WRITES !== '1') throw new HttpError(403, 'Демо-дневник только для просмотра');
  // На устройстве может быть полка из нескольких дневников: в заголовке все её ключи через запятую.
  if (!ownsDiary(req, day.diaryId)) throw new HttpError(403, 'Менять день может только владелец дневника');
}

/** Есть ли ключ этого дневника среди ключей, присланных браузером. */
export function ownsDiary(req: Request, diaryId: string): boolean {
  return (req.headers.get(DIARY_KEY_HEADER) ?? '').split(',').map((k) => k.trim()).includes(diaryId);
}

export function urlPaths(d: DayRecord): string[] {
  return [
    ...d.photos.flatMap((p) => [p.path, p.thumbPath]),
    d.posterPath, d.voice?.path, d.song.kind === 'file' ? d.song.path : null,
  ].filter((p): p is string => !!p);
}

export function attachUrls(d: DayRecord, urls: Record<string, string>): DayRecord {
  const songUrl = d.song.kind === 'file' ? (d.song.path ? urls[d.song.path] : undefined) : d.song.kind === 'link' ? d.song.previewUrl : undefined;
  return {
    ...d,
    photos: d.photos.map((p) => ({ ...p, url: urls[p.path], thumbUrl: urls[p.thumbPath] })),
    posterUrl: d.posterPath ? urls[d.posterPath] : undefined,
    voice: d.voice ? { ...d.voice, url: urls[d.voice.path] } : null,
    songUrl,
  };
}

export async function withUrls(days: DayRecord[]): Promise<DayRecord[]> {
  const urls = await signRead(days.flatMap(urlPaths));
  return days.map((d) => attachUrls(d, urls));
}

export async function getDayRow(id: string): Promise<DayRecord | null> {
  const { data, error } = await supabaseAdmin().from('days').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToDay(data as DayRow) : null;
}

/** День по ссылке-подарку (план 20.11, A4). */
export async function getDayByShare(shareId: string): Promise<DayRecord | null> {
  const { data, error } = await supabaseAdmin().from('days').select('*').eq('share_id', shareId).maybeSingle();
  if (error) throw error;
  return data ? rowToDay(data as DayRow) : null;
}

export async function updateDay(id: string, patch: Partial<DayRow>): Promise<DayRecord> {
  const { data, error } = await supabaseAdmin().from('days').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return rowToDay(data as DayRow);
}

export async function diaryExists(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().from('diaries').select('id').eq('id', id).maybeSingle();
  if (error) throw error;
  return !!data;
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export const isDiaryId = (s: string) => s === demoDiaryId() || isUuid(s);
