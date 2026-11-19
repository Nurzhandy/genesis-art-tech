// Папка дня в Supabase Storage: пути, signed URLs, перенос черновика (A1).
import { BUCKET, supabaseAdmin } from './supabase/server';

const pad = (i: number) => String(i + 1).padStart(2, '0');

export function dayFolder(diaryId: string, date: string, slug: string | null, dayId: string): string {
  return slug ? `${diaryId}/${date}-${slug}` : `${diaryId}/_draft-${dayId}`;
}

export function dayFiles(folder: string) {
  return {
    photo: (i: number, ext = 'jpg') => `${folder}/photos/${pad(i)}.${ext}`,
    thumb: (i: number) => `${folder}/photos/thumb/${pad(i)}.jpg`,
    audio: (ext: string) => `${folder}/song.${ext}`,
    poster: `${folder}/memory.jpg`,
    voice: `${folder}/voice.mp3`,
    text: `${folder}/text.md`,
    json: (name: 'analysis' | 'style' | 'song') => `${folder}/${name}.json`,
  };
}

/** Signed URLs на чтение (по умолчанию на час). Пустые пути пропускаются. */
export async function signRead(paths: (string | null | undefined)[], ttlSec = 3600): Promise<Record<string, string>> {
  const list = [...new Set(paths.filter((p): p is string => !!p))];
  if (!list.length) return {};
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUrls(list, ttlSec);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const item of data ?? []) if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  return out;
}

export async function signUpload(path: string): Promise<{ path: string; token: string; signedUrl: string }> {
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error) throw error;
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

export async function putFile(path: string, body: Blob | Buffer | string, contentType: string): Promise<void> {
  const { error } = await supabaseAdmin().storage.from(BUCKET).upload(path, body, { contentType, upsert: true });
  if (error) throw error;
}

export async function getFile(path: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).download(path);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

export async function moveFile(from: string, to: string): Promise<void> {
  if (from === to) return;
  const { error } = await supabaseAdmin().storage.from(BUCKET).move(from, to);
  if (error) throw error;
}

export interface StoredFile { path: string; size: number }

/** Все файлы папки дня с размерами, рекурсивно (photos/, photos/thumb/). */
export async function listFolder(folder: string, depth = 3): Promise<StoredFile[]> {
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).list(folder, { limit: 200, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw error;
  const out: StoredFile[] = [];
  for (const item of data ?? []) {
    const path = `${folder}/${item.name}`;
    // У подпапок нет id и metadata — это «префиксы», заходим внутрь.
    if (!item.id) { if (depth > 0) out.push(...(await listFolder(path, depth - 1))); continue; }
    if (item.name === '.emptyFolderPlaceholder') continue;
    out.push({ path, size: Number(item.metadata?.size ?? 0) });
  }
  return out;
}

export async function removeFiles(paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabaseAdmin().storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw error;
  }
}
