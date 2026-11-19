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
    poster: `${folder}/memory.png`,
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

export async function fileSizes(paths: string[]): Promise<Record<string, number>> {
  const byDir = new Map<string, string[]>();
  for (const p of paths) {
    const i = p.lastIndexOf('/');
    const dir = p.slice(0, i);
    byDir.set(dir, [...(byDir.get(dir) ?? []), p.slice(i + 1)]);
  }
  const out: Record<string, number> = {};
  for (const [dir, names] of byDir) {
    const { data } = await supabaseAdmin().storage.from(BUCKET).list(dir, { limit: 100 });
    for (const f of data ?? []) if (names.includes(f.name)) out[`${dir}/${f.name}`] = (f.metadata?.size as number) ?? 0;
  }
  return out;
}
