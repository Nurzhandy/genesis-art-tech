// Доступ к таблице days и превращение строк в DayRecord с signed URLs.
import type { DayRecord, DayStatus } from './types';
import { signRead } from './storage';
import { supabaseAdmin } from './supabase/server';

export interface DayRow {
  id: string; diary_id: string; date: string; title: string | null; slug: string | null; text: string;
  photos: DayRecord['photos']; song: DayRecord['song']; music: DayRecord['music'];
  analysis: DayRecord['analysis']; style: DayRecord['style']; voice: DayRecord['voice'];
  poster_path: string | null; status: DayStatus; error: string | null; created_at: string;
}

export function rowToDay(r: DayRow): DayRecord {
  return {
    id: r.id, diaryId: r.diary_id, date: r.date, title: r.title, slug: r.slug, text: r.text,
    photos: r.photos ?? [], song: r.song, music: r.music, analysis: r.analysis, style: r.style, voice: r.voice,
    posterPath: r.poster_path, status: r.status, error: r.error, createdAt: r.created_at,
  };
}

export function urlPaths(d: DayRecord): string[] {
  return [
    ...d.photos.flatMap((p) => [p.path, p.thumbPath]),
    d.posterPath, d.voice?.path, d.song.kind === 'file' ? d.song.path : null,
  ].filter((p): p is string => !!p);
}

export function attachUrls(d: DayRecord, urls: Record<string, string>): DayRecord {
  const songUrl = d.song.kind === 'file' ? (d.song.path ? urls[d.song.path] : undefined) : d.song.previewUrl;
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
export const isDiaryId = (s: string) => s === (process.env.DEMO_DIARY_ID ?? 'demo') || isUuid(s);
