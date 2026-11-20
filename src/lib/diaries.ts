// Дневники на сервере: карточки полки (название, вид, число дней, цвет и постер последнего дня).
import { DIARY_KINDS, type DiaryKind, type DiaryMeta } from './shelf';
import { signRead } from './storage';
import { supabaseAdmin } from './supabase/server';

interface DiaryRow { id: string; title: string | null; kind: DiaryKind | null; created_at: string }
interface DayLite { diary_id: string; date: string; poster_path: string | null; style: { palette?: { accents?: string[]; bg?: string } } | null; sealed_until: string | null }

export async function diaryMetas(ids: string[]): Promise<DiaryMeta[]> {
  const list = [...new Set(ids)].filter(Boolean).slice(0, 50);
  if (!list.length) return [];
  const db = supabaseAdmin();
  const { data: diaries, error } = await db.from('diaries').select('id,title,kind,created_at').in('id', list);
  if (error) throw error;
  const { data: days, error: e2 } = await db.from('days').select('diary_id,date,poster_path,style,sealed_until')
    .in('diary_id', list).eq('status', 'ready').order('date', { ascending: false }).limit(2000);
  if (e2) throw e2;
  const byDiary = new Map<string, DayLite[]>();
  for (const d of (days ?? []) as DayLite[]) byDiary.set(d.diary_id, [...(byDiary.get(d.diary_id) ?? []), d]);
  // Обложка — последний день, который не капсула (капсула не выдаёт ни постера, ни цвета).
  const today = new Date().toISOString().slice(0, 10);
  const lastOpen = (id: string) => (byDiary.get(id) ?? []).find((d) => !d.sealed_until || d.sealed_until <= today);
  const posters = await signRead((diaries ?? []).map((d) => lastOpen(d.id)?.poster_path));
  const order = new Map(list.map((id, i) => [id, i]));
  return ((diaries ?? []) as DiaryRow[])
    .map((d) => {
      const kind = (d.kind ?? 'memories') as DiaryKind;
      const last = lastOpen(d.id);
      return {
        id: d.id, kind, createdAt: d.created_at,
        title: d.title ?? (d.id === 'demo' ? 'Демо-дневник' : DIARY_KINDS[kind].defaultTitle),
        dayCount: byDiary.get(d.id)?.length ?? 0,
        lastColor: last?.style?.palette?.accents?.[0] ?? null,
        lastPosterUrl: last?.poster_path ? posters[last.poster_path] : undefined,
      };
    })
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
