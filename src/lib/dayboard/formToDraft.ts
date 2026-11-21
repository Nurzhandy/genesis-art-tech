// «Простая форма» для черновика доски дня (план 21.11, C2): форма не создаёт новый день, а раскладывает
// введённое на доску того же черновика и собирает его. То, что уже лежало на доске, остаётся на месте,
// новое ложится ниже. Сетевые вызовы приходят снаружи (deps), поэтому логику можно проверить тестом.
import type { Board, BoardItem } from '@/lib/board/board';
import type { DayRecord, MusicFeatures, PhotoFeatures } from '@/lib/types';
import { boardBox } from './layout';

export interface FormSong { url: string; title: string; cover?: string; preview?: string }
export interface FormVoice { blob: Blob; ext: string; sec: number }
export interface FormInput {
  date: string;
  place: string;
  text: string;
  photos: { blob: Blob; ratio: number }[];
  song: FormSong | null;
  feelings: string[];
  voice: FormVoice | null;
}

type Upload = { path: string; token: string; signedUrl: string };
export type AssembleInput = { photoFeatures: PhotoFeatures[]; music?: MusicFeatures | null; coverPalette?: string[]; photoHour?: number; date?: string; place?: string };

export interface DraftDeps {
  dayBoard(dayId: string): Promise<{ board: Board; urls: Record<string, string> }>;
  saveDayBoard(dayId: string, board: Board): Promise<unknown>;
  dayBoardUpload(dayId: string, ext?: string): Promise<Upload>;
  uploadFile(u: Upload & { kind: 'photo' | 'voice' }, blob: Blob): Promise<void>;
  /** Признаки фото, музыка и цвета обложки по всей доске (prepareAssembly из AssembleBar). */
  prepare(items: BoardItem[], urls: Record<string, string>, date: string): Promise<AssembleInput>;
  assembleDay(dayId: string, body: AssembleInput): Promise<DayRecord>;
}

const NOTE_MAX = 2000;
const GAP = 120;

/** Длинный текст режем на заметки ≤ 2000 символов по абзацам (так требует схема доски). */
export function splitText(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (const para of text.trim().split(/\n{2,}/)) {
    for (let p = para; p.length; ) {
      const piece = p.slice(0, NOTE_MAX);
      p = p.slice(NOTE_MAX);
      const joined = cur ? `${cur}\n\n${piece}` : piece;
      if (joined.length <= NOTE_MAX) cur = joined;
      else { out.push(cur); cur = piece; }
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** Новые элементы доски из формы: ниже всего, что уже лежит, чтобы старое шло первым в порядке чтения. */
export function formItems(
  existing: BoardItem[],
  add: { text: string; photos: { path: string; ratio: number }[]; song: FormSong | null; feelings: string[]; voice: { path: string; sec: number } | null },
  uid: () => string,
): BoardItem[] {
  const box = boardBox(existing);
  const x0 = box ? Math.round(box.x) : 0;
  const y0 = box ? Math.round(box.y + box.h + GAP) : 0;
  const items: BoardItem[] = [];
  const notes = splitText(add.text);
  notes.forEach((text, i) => items.push({ id: uid(), kind: 'note', x: x0, y: y0 + i * 130, rot: i % 2 ? 1.5 : -1.5, text, w: 360, color: '#f4efe6', font: 'hand' }));
  add.photos.forEach((p, i) => items.push({ id: uid(), kind: 'photo', x: x0 + 420 + i * 270, y: y0, rot: [2, -3, 1.5, -2, 3][i % 5], path: p.path, w: 240, ratio: Math.min(10, Math.max(0.1, p.ratio)) }));
  const below = y0 + Math.max(1, notes.length) * 130 + 40;
  if (add.song) {
    items.push({ id: uid(), kind: 'song', x: x0, y: below, rot: 0, url: add.song.url, title: add.song.title.slice(0, 200) || 'Песня дня', size: 160,
      ...(add.song.cover ? { cover: add.song.cover } : {}), ...(add.song.preview ? { preview: add.song.preview } : {}) });
  }
  const feelings = [...new Set(add.feelings.map((f) => f.trim()).filter(Boolean))].slice(0, 3);
  if (feelings.length) items.push({ id: uid(), kind: 'mood', x: x0 + 220, y: below + 20, rot: 0, feelings, size: 130 });
  if (add.voice) items.push({ id: uid(), kind: 'voice', x: x0 + 400, y: below + 40, rot: 0, path: add.voice.path, sec: Math.max(0, Math.min(600, add.voice.sec)), peaks: [], w: 320 });
  return items;
}

/** Раскладывает форму на доску черновика, сохраняет и собирает тот же день. Новый день не создаётся. */
export async function submitToDraft(draftId: string, input: FormInput, deps: DraftDeps, uid: () => string): Promise<DayRecord> {
  const { board } = await deps.dayBoard(draftId);
  const photos = [];
  for (const p of input.photos) {
    const u = await deps.dayBoardUpload(draftId);
    await deps.uploadFile({ ...u, kind: 'photo' }, p.blob);
    photos.push({ path: u.path, ratio: p.ratio });
  }
  let voice: { path: string; sec: number } | null = null;
  if (input.voice) {
    const u = await deps.dayBoardUpload(draftId, input.voice.ext);
    await deps.uploadFile({ ...u, kind: 'voice' }, input.voice.blob);
    voice = { path: u.path, sec: input.voice.sec };
  }
  const items = [...board.items, ...formItems(board.items, { text: input.text, photos, song: input.song, feelings: input.feelings, voice }, uid)];
  await deps.saveDayBoard(draftId, { v: 1, items });
  const { urls } = await deps.dayBoard(draftId); // свежие ссылки и на новые фото
  const body = await deps.prepare(items, urls, input.date);
  return deps.assembleDay(draftId, { ...body, date: input.date, place: input.place.trim() });
}
