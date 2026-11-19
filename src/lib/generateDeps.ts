// Реальные зависимости generateDay: Supabase, Claude, Deezer, движок стиля.
import { analyzeDay } from './ai/analyzeDay';
import { getDayRow, updateDay } from './db';
import type { GenerateDeps } from './generateDay';
import { resolveSong } from './music/resolve';
import { getFile, moveFile, putFile } from './storage';
import { buildStyle } from './style/buildStyle';
import { supabaseAdmin } from './supabase/server';

export function realDeps(): GenerateDeps {
  return {
    getDay: getDayRow,
    updateDay,
    async recentGenerations(diaryId) {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count, error } = await supabaseAdmin().from('days').select('id', { count: 'exact', head: true })
        .eq('diary_id', diaryId).neq('status', 'draft').gte('created_at', since);
      if (error) throw error;
      return count ?? 0;
    },
    async slugTaken(diaryId, slug, date, exceptId) {
      const { data, error } = await supabaseAdmin().from('days').select('id')
        .eq('diary_id', diaryId).eq('slug', slug).eq('date', date).neq('id', exceptId).limit(1);
      if (error) throw error;
      return (data ?? []).length > 0;
    },
    async loadThumbs(paths) {
      const out = [];
      for (const p of paths) {
        try { out.push({ base64: (await getFile(p)).toString('base64'), mediaType: 'image/jpeg' as const }); } catch { /* нет превью — анализируем без него */ }
      }
      return out;
    },
    analyze: (input) => analyzeDay(input),
    resolveSong: (url) => resolveSong(url),
    buildStyle,
    moveFile: async (from, to) => {
      try { await moveFile(from, to); } catch (e) {
        // Повторная генерация после ошибки: файл мог уже переехать.
        if (!/not.?found|does not exist/i.test(String((e as Error).message))) throw e;
      }
    },
    putFile: (path, body, type) => putFile(path, body, type),
    limit: Number(process.env.GENERATE_LIMIT_PER_DAY ?? 30),
  };
}
