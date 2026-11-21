// Первый вход (план 21.11, часть A): дневники с полки этого устройства (x-diary-key) привязываются к аккаунту.
// Привязываем только дневники без владельца; чужие (с другим owner_id) не трогаем.
import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth';
import { claimable } from '@/lib/authShared';
import { DIARY_KEY_HEADER, demoDiaryId, isUuid } from '@/lib/db';
import { handle } from '@/lib/http';
import { supabaseAdmin } from '@/lib/supabase/server';

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const keys = [...new Set((req.headers.get(DIARY_KEY_HEADER) ?? '').split(',').map((k) => k.trim()).filter(isUuid))].slice(0, 50);
  if (!keys.length) return Response.json({ claimed: [] });
  const db = supabaseAdmin();
  const { data, error } = await db.from('diaries').select('id,owner_id').in('id', keys);
  if (error) throw error;
  const ids = claimable((data ?? []) as { id: string; owner_id: string | null }[], demoDiaryId());
  if (!ids.length) return Response.json({ claimed: [] });
  // is(owner_id, null) ещё раз в самом обновлении: если кто-то успел привязать дневник раньше, его не перехватываем.
  const { data: done, error: e2 } = await db.from('diaries').update({ owner_id: user.id }).in('id', ids).is('owner_id', null).select('id');
  if (e2) throw e2;
  return Response.json({ claimed: ((done ?? []) as { id: string }[]).map((d) => d.id) });
});
