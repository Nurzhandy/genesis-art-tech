// «Рассказать день»: голос или расшифровка → запись в дневник (+ город и песня, если названы).
import type { NextRequest } from 'next/server';
import { getLlm } from '@/lib/ai/analyzeDay';
import { StoryInput, storyToEntry } from '@/lib/ai/story';
import { handle, HttpError, readJson } from '@/lib/http';

export const maxDuration = 60;

/** Песня, названная в рассказе, → ссылка на Deezer, чтобы форма сразу её распознала. */
async function songLink(query: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.deezer.com/search?limit=1&q=${encodeURIComponent(query.replace(/[—–-]/g, ' '))}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const id = ((await res.json()) as { data?: { id?: number }[] }).data?.[0]?.id;
    return id ? `https://www.deezer.com/track/${id}` : null;
  } catch {
    return null;
  }
}

export const POST = handle(async (req: NextRequest) => {
  const input = StoryInput.parse(await readJson(req));
  try {
    const story = await storyToEntry(input, getLlm());
    return Response.json({ ...story, songUrl: story.song ? await songLink(story.song) : null });
  } catch (e) {
    throw new HttpError(422, e instanceof Error ? e.message : 'Не получилось разобрать рассказ');
  }
});
