import type { NextRequest } from 'next/server';
import { isSealed, serverToday } from '@/lib/capsule';
import { assertCanEdit, getDayRow, isUuid, updateDay } from '@/lib/db';
import { ownVoicePreset } from '@/lib/voice/ownVoice';
import { handle, HttpError, readJson } from '@/lib/http';
import { dayFiles, dayFolder, signUpload } from '@/lib/storage';
import { UploadRequest } from '@/lib/validation';

export const POST = handle(async (req: NextRequest, ctx: RouteContext<'/api/days/[dayId]/uploads'>) => {
  const { dayId } = await ctx.params;
  const day = isUuid(dayId) ? await getDayRow(dayId) : null;
  if (!day) throw new HttpError(404, 'День не найден');
  const { files } = UploadRequest.parse(await readJson(req));
  // Свой голос записывает только владелец готового, не запечатанного дня.
  if (files.some((f) => f.kind === 'voice')) {
    assertCanEdit(req, day);
    if (day.status !== 'ready') throw new HttpError(409, 'День ещё не собран');
    if (isSealed(day, serverToday())) throw new HttpError(409, 'Капсула ещё запечатана');
  }
  const f = dayFiles(dayFolder(day.diaryId, day.date, day.slug, day.id));
  const uploads = await Promise.all(files.map(async (file) => {
    if (file.kind !== 'poster' && file.kind !== 'voice' && day.status !== 'draft') throw new HttpError(409, 'Файлы дня уже собраны');
    if (file.kind === 'poster' && day.status !== 'ready') throw new HttpError(409, 'Постер можно загрузить только для готового дня');
    const path = file.kind === 'photo' ? f.photo(file.index, file.ext === 'jpeg' ? 'jpg' : file.ext)
      : file.kind === 'thumb' ? f.thumb(file.index)
      : file.kind === 'audio' ? f.audio(file.ext)
      : file.kind === 'voice' ? f.ownVoice(file.ext)
      : f.poster;
    const signed = await signUpload(path);
    return { kind: file.kind, index: 'index' in file ? file.index : undefined, ...signed };
  }));
  // Запоминаем пути, которые знает только сервер: постер и собственный аудиофайл.
  const poster = uploads.find((u) => u.kind === 'poster');
  const audio = uploads.find((u) => u.kind === 'audio');
  const voice = uploads.find((u) => u.kind === 'voice');
  if (poster || voice || (audio && day.song.kind === 'file')) {
    await updateDay(day.id, {
      ...(voice ? { voice: { path: voice.path, preset: ownVoicePreset() } } : {}),
      ...(poster ? { poster_path: poster.path } : {}),
      ...(audio && day.song.kind === 'file' ? { song: { ...day.song, path: audio.path } } : {}),
    });
  }
  return Response.json({ uploads });
});
