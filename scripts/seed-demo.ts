// Прогон любимых дней команды через тот же пайплайн, что и браузер, в демо-дневник (A9).
// Формат: fixtures/demo/<папка>/{text.md, date.txt, song.json, photos/*.jpg|png|heic}, необязательно place.txt (город для погоды)
// Запуск: сервер с ALLOW_DEMO_WRITES=1 (например `ALLOW_DEMO_WRITES=1 npm run dev`), затем
//   BASE_URL=http://localhost:3000 npx tsx scripts/seed-demo.ts
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { computeFeatures } from '../src/lib/client/photoFeatures';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const DIARY = process.env.DEMO_DIARY_ID ?? 'demo';
const ROOT = 'fixtures/demo';

function loadEnv() {
  if (!fs.existsSync('.env.local')) return;
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const m = /^([A-Z_]+)=([^#]*)/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

async function call<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + url, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (!res.ok) throw new Error(`${url}: ${json.error ?? res.status}`);
  return json as T;
}

async function main() {
  loadEnv();
  const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).storage.from('days');
  const dirs = fs.readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  if (!dirs.length) { console.log(`Нет дней в ${ROOT}/ — см. ${ROOT}/README.md`); return; }

  for (const dir of dirs) {
    const base = path.join(ROOT, dir);
    const text = fs.readFileSync(path.join(base, 'text.md'), 'utf8').trim();
    const date = fs.readFileSync(path.join(base, 'date.txt'), 'utf8').trim();
    const song = JSON.parse(fs.readFileSync(path.join(base, 'song.json'), 'utf8'));
    const placeFile = path.join(base, 'place.txt');
    const place = fs.existsSync(placeFile) ? fs.readFileSync(placeFile, 'utf8').trim() : '';
    const photoFiles = fs.readdirSync(path.join(base, 'photos')).filter((f) => /\.(jpe?g|png|webp|heic)$/i.test(f)).sort().slice(0, 5);

    // Песня-ссылка: распознаём так же, как форма.
    let songRef = song;
    let music = null;
    if (song.kind === 'link') {
      const r = await call<{ song: unknown; music: unknown }>(`/api/music/resolve?url=${encodeURIComponent(song.url)}`);
      songRef = { ...(r.song as object), ...song };
      music = r.music;
    }

    const photos = await Promise.all(photoFiles.map(async (f, i) => {
      const src = sharp(path.join(base, 'photos', f)).rotate();
      const full = await src.clone().resize(1600, 1600, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
      const thumb = await src.clone().resize(768, 768, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
      const small = await src.clone().resize(200, 200, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const features = { ...computeFeatures(new Uint8ClampedArray(small.data), small.info.width, small.info.height, i), width: full.info.width, height: full.info.height };
      return { full: full.data, thumb, features };
    }));

    const { dayId } = await call<{ dayId: string }>(`/api/diaries/${DIARY}/days`, { date, text, photoCount: photos.length, song: songRef, ...(place ? { place } : {}) });
    const files = photos.flatMap((_, i) => [{ kind: 'photo', index: i, ext: 'jpg' }, { kind: 'thumb', index: i, ext: 'jpg' }]);
    const { uploads } = await call<{ uploads: { kind: string; index?: number; path: string; token: string }[] }>(`/api/days/${dayId}/uploads`, { files });
    for (const u of uploads) {
      const buf = u.kind === 'photo' ? photos[u.index!].full : photos[u.index!].thumb;
      const { error } = await storage.uploadToSignedUrl(u.path, u.token, buf, { contentType: 'image/jpeg' });
      if (error) throw error;
    }
    const day = await call<{ title: string; style: { techniques: { primary: string } } }>(`/api/days/${dayId}/generate`, { photoFeatures: photos.map((p) => p.features), music });
    console.log(`✓ ${dir} → «${day.title}» (${day.style.techniques.primary})  ${BASE}/day/${dayId}`);
  }
  console.log('\nОткройте каждую ссылку один раз — постер дня сохранится автоматически.');
}

main().catch((e) => { console.error(e); process.exit(1); });
