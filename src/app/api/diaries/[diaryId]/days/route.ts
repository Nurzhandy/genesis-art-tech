import type { NextRequest } from 'next/server';
import { diaryExists, isDiaryId, rowToDay, withUrls, type DayRow } from '@/lib/db';
import { revealable, sealDateError, serverToday } from '@/lib/capsule';
import { handle, HttpError, readJson } from '@/lib/http';
import { sameSong } from '@/lib/music/songKey';
import { supabaseAdmin } from '@/lib/supabase/server';
import { emptyBoard } from '@/lib/board/board';
import { NewDayInput, NewDraftInput } from '@/lib/validation';

const DEMO = () => process.env.DEMO_DIARY_ID ?? 'demo';

export const GET = handle(async (req: NextRequest, ctx: RouteContext<'/api/diaries/[diaryId]/days'>) => {
  const { diaryId } = await ctx.params;
  if (!isDiaryId(diaryId) || (diaryId !== DEMO() && !(await diaryExists(diaryId)))) throw new HttpError(404, 'Дневник не найден');
  const q = (req.nextUrl.searchParams.get('q') ?? '').replace(/[%,()*\\]/g, ' ').trim().slice(0, 80);
  // ?drafts=1 (план 21.11, доска дня): доска дневника показывает и пустые черновики с подписью «черновик».
  const statuses = req.nextUrl.searchParams.get('drafts') === '1' ? ['ready', 'draft'] : ['ready'];
  let query = supabaseAdmin().from('days').select('*').eq('diary_id', diaryId).in('status', statuses)
    .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(200);
  if (q) query = query.or(`title.ilike.%${q}%,text.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) throw error;
  const today = serverToday();
  let days = (data as DayRow[]).map((r) => revealable(rowToDay(r), today));
  // «Все дни этой песни» (план 20.11, A6): ключ из songKey; запечатанные капсулы песню не выдают.
  const songs = req.nextUrl.searchParams.getAll('song').slice(0, 4).map((s) => s.slice(0, 300));
  if (songs.length) days = days.filter((d) => sameSong(d.song, songs));
  return Response.json(await withUrls(days));
});

export const POST = handle(async (req: NextRequest, ctx: RouteContext<'/api/diaries/[diaryId]/days'>) => {
  const { diaryId } = await ctx.params;
  if (diaryId === DEMO() && process.env.ALLOW_DEMO_WRITES !== '1') throw new HttpError(403, 'Демо-дневник только для просмотра');
  if (!isDiaryId(diaryId) || !(await diaryExists(diaryId))) throw new HttpError(404, 'Дневник не найден');
  const raw = await readJson(req);
  // Черновик под доску дня (план 21.11): пустой день, всё остальное — на доске.
  const draft = NewDraftInput.safeParse(raw);
  if (draft.success) {
    const { data, error } = await supabaseAdmin().from('days')
      .insert({ diary_id: diaryId, date: draft.data.date, text: '', song: { kind: 'none' }, photos: [], status: 'draft',
        place: draft.data.place || null, board: emptyBoard() })
      .select('id').single();
    if (error) throw error;
    return Response.json({ dayId: data.id }, { status: 201 });
  }
  const input = NewDayInput.parse(raw);
  const sealError = input.sealedUntil ? sealDateError(input.sealedUntil, serverToday()) : null;
  if (sealError) throw new HttpError(400, sealError);
  const song = input.song.kind === 'file'
    ? { kind: 'file' as const, title: input.song.title, artist: input.song.artist, ext: input.song.ext ?? 'mp3' }
    : input.song;
  const { data, error } = await supabaseAdmin().from('days')
    .insert({ diary_id: diaryId, date: input.date, text: input.text, song, photos: [], status: 'draft',
      place: input.place || null, sealed_until: input.sealedUntil ?? null, ...(input.feeling ? { feeling: input.feeling } : {}) })
    .select('id').single();
  if (error) throw error;
  return Response.json({ dayId: data.id }, { status: 201 });
});
