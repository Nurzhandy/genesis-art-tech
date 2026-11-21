// Файлы локального режима (без ключей Supabase): отдать и принять файл папки дня. На Vercel — 404.
import type { NextRequest } from 'next/server';
import { isLocalMode, readLocalFile, writeLocalFile } from '@/lib/supabase/local';

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp3: 'audio/mpeg', m4a: 'audio/mp4',
  wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm', mp4: 'audio/mp4', json: 'application/json', md: 'text/markdown; charset=utf-8',
};

async function filePathOf(ctx: RouteContext<'/api/local/files/[...path]'>) {
  const { path } = await ctx.params;
  const p = path.map(decodeURIComponent).join('/');
  if (p.includes('..')) throw new Error('bad path');
  return p;
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/local/files/[...path]'>) {
  if (!isLocalMode()) return new Response('Not found', { status: 404 });
  const p = await filePathOf(ctx);
  const body = readLocalFile(p);
  if (!body) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: { 'content-type': TYPES[p.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream', 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
  });
}

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/local/files/[...path]'>) {
  if (!isLocalMode()) return new Response('Not found', { status: 404 });
  const p = await filePathOf(ctx);
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length > 15 * 1024 * 1024) return Response.json({ error: 'Файл больше 15 МБ' }, { status: 413 });
  writeLocalFile(p, body);
  return Response.json({ path: p });
}
