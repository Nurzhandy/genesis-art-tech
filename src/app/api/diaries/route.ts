import { randomUUID } from 'node:crypto';
import { handle } from '@/lib/http';
import { supabaseAdmin } from '@/lib/supabase/server';

export const POST = handle(async () => {
  const id = randomUUID();
  const { error } = await supabaseAdmin().from('diaries').insert({ id });
  if (error) throw error;
  return Response.json({ diaryId: id }, { status: 201 });
});
