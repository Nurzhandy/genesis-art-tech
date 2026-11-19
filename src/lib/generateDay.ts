// Генерация дня: анализ → музыка → стиль → название → папка дня (A6).
import type { DayAnalysis, DayRecord, MusicFeatures, PhotoFeatures, SongRef, StyleInput, StyleParams } from './types';
import type { AnalyzeInput } from './ai/analyzeDay';
import { HttpError } from './http';
import { mergeMusic } from './music/resolve';
import { dayFiles, dayFolder } from './storage';
import { slugify } from './title/validateTitle';
import type { DayRow } from './db';
import type { GenerateBody } from './validation';

export interface GenerateDeps {
  getDay(id: string): Promise<DayRecord | null>;
  updateDay(id: string, patch: Partial<DayRow>): Promise<DayRecord>;
  recentGenerations(diaryId: string): Promise<number>;
  slugTaken(diaryId: string, slug: string, date: string, exceptId: string): Promise<boolean>;
  loadThumbs(paths: string[]): Promise<AnalyzeInput['photos']>;
  analyze(input: AnalyzeInput): Promise<DayAnalysis>;
  resolveSong(url: string): Promise<{ song: SongRef; music: MusicFeatures | null }>;
  buildStyle(input: StyleInput): StyleParams;
  moveFile(from: string, to: string): Promise<void>;
  putFile(path: string, body: string, contentType: string): Promise<void>;
  limit: number;
}

/** FNV-1a: стабильный seed стиля из id дня. */
export function seedFromId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 1_000_000_007;
}

export async function generateDay(dayId: string, body: GenerateBody, deps: GenerateDeps): Promise<DayRecord> {
  const day = await deps.getDay(dayId);
  if (!day) throw new HttpError(404, 'День не найден');
  if (day.status === 'ready') return day;
  if (day.status === 'generating') throw new HttpError(409, 'День уже собирается');
  if ((await deps.recentGenerations(day.diaryId)) >= deps.limit) throw new HttpError(429, 'Лимит на сегодня исчерпан');

  const features: PhotoFeatures[] = [...body.photoFeatures].sort((a, b) => a.index - b.index);
  const draft = dayFiles(dayFolder(day.diaryId, day.date, null, day.id));
  // Признаки фото сохраняем сразу: после ошибки день можно собрать повторно со страницы дня.
  await deps.updateDay(day.id, {
    status: 'generating', error: null,
    photos: features.map((f) => ({ path: draft.photo(f.index), thumbPath: draft.thumb(f.index), features: f })),
    music: body.music,
  });
  try {

    // Песня: дополняем ссылку данными, если браузер их не прислал.
    let song: SongRef = day.song;
    let deezer: MusicFeatures | null = body.music?.source === 'deezer' ? body.music : null;
    const audio: MusicFeatures | null = body.music?.source === 'audio' ? body.music : null;
    if (song.kind === 'link' && (!song.title || !deezer)) {
      try {
        const r = await deps.resolveSong(song.url);
        song = { ...r.song, ...Object.fromEntries(Object.entries(song).filter(([, v]) => v !== undefined)) } as SongRef;
        deezer ??= r.music;
      } catch { /* песня без метаданных — не повод падать */ }
    }

    const thumbs = await deps.loadThumbs(features.map((f) => draft.thumb(f.index))).catch(() => []);
    const analysis = await deps.analyze({ text: day.text, date: day.date, photos: thumbs, photoFeatures: features, song });
    const music = mergeMusic(audio, deezer, analysis.songGuess);
    const style = deps.buildStyle({ analysis, photos: features, music, date: day.date, seed: seedFromId(day.id) });

    // Название и уникальная папка.
    const title = analysis.title;
    const base = slugify(title);
    let slug = base;
    for (let n = 2; await deps.slugTaken(day.diaryId, slug, day.date, day.id); n++) slug = `${base}-${n}`;
    const final = dayFiles(dayFolder(day.diaryId, day.date, slug, day.id));

    const photos = features.map((f) => ({ path: final.photo(f.index), thumbPath: final.thumb(f.index), features: f }));
    for (const f of features) {
      await deps.moveFile(draft.photo(f.index), final.photo(f.index));
      await deps.moveFile(draft.thumb(f.index), final.thumb(f.index));
    }
    if (song.kind === 'file' && song.path) {
      const ext = song.path.split('.').pop() ?? 'mp3';
      await deps.moveFile(song.path, final.audio(ext));
      song = { ...song, path: final.audio(ext) };
    }

    const json = (v: unknown) => JSON.stringify(v, null, 2);
    await deps.putFile(final.text, `# ${title}\n\n${day.date}\n\n${day.text}\n`, 'text/markdown; charset=utf-8');
    await deps.putFile(final.json('song'), json(song), 'application/json');
    await deps.putFile(final.json('analysis'), json(analysis), 'application/json');
    await deps.putFile(final.json('style'), json(style), 'application/json');

    return await deps.updateDay(day.id, {
      status: 'ready', error: null, title, slug, photos, song, music, analysis, style,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await deps.updateDay(day.id, { status: 'error', error: message.slice(0, 300) }).catch(() => undefined);
    throw new HttpError(500, 'Не получилось собрать день: ' + message.slice(0, 120));
  }
}
