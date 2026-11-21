// Дневники аккаунта (план 21.11, часть A): после входа браузер кладёт их на полку устройства.
import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth';
import { diaryMetas } from '@/lib/diaries';
import { handle } from '@/lib/http';
import { supabaseAdmin } from '@/lib/supabase/server';

export const GET = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const { data, error } = await supabaseAdmin().from('diaries').select('id').eq('owner_id', user.id)
    .order('created_at', { ascending: true }).limit(50);
  if (error) throw error;
  const ids = ((data ?? []) as { id: string }[]).map((d) => d.id);
  return Response.json({ ids, diaries: await diaryMetas(ids) });
});
