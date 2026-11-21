import type { NextRequest } from 'next/server';
import { getDayRow, isUuid, updateDay } from '@/lib/db';
import { isSealed, serverToday } from '@/lib/capsule';
import { handle, HttpError } from '@/lib/http';
import { dayFiles, dayFolder, putFile, signRead } from '@/lib/storage';
import { pickVoice } from '@/lib/voice/pickVoice';
import { synthesize, type SpeechAudio } from '@/lib/voice/tts';

export const maxDuration = 60;

export const POST = handle(async (_req: NextRequest, ctx: RouteContext<'/api/days/[dayId]/voice'>) => {
  const { dayId } = await ctx.params;
  const day = isUuid(dayId) ? await getDayRow(dayId) : null;
  if (!day || day.status !== 'ready' || !day.analysis) throw new HttpError(404, 'День не найден или ещё не собран');
  if (isSealed(day, serverToday())) throw new HttpError(403, 'Капсула ещё запечатана');
  const preset = pickVoice(day.analysis, day.music);
  if (day.voice?.path) {
    const urls = await signRead([day.voice.path]);
    if (urls[day.voice.path]) return Response.json({ url: urls[day.voice.path], preset: day.voice.preset });
  }
  let audio: SpeechAudio | null = null;
  try {
    audio = await synthesize(day.text, preset);
  } catch (e) {
    console.error('voice: TTS недоступен, озвучка в браузере', e instanceof Error ? e.message : e);
  }
  if (!audio) return Response.json({ url: null, preset });
  const path = dayFiles(dayFolder(day.diaryId, day.date, day.slug, day.id)).voiceFile(audio.ext);
  await putFile(path, audio.data, audio.contentType);
  await updateDay(day.id, { voice: { path, preset } });
  const urls = await signRead([path]);
  return Response.json({ url: urls[path] ?? null, preset });
});
