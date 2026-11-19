// Временные фото-заглушки для /lab: процедурные «сцены» в цветах фикстур. Заменить на настоящие фото команды.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const dir = 'fixtures/days';
let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

for (const file of fs.readdirSync(dir)) {
  const name = file.replace('.json', '');
  const { input } = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const out = path.join('public/fixtures', name);
  fs.mkdirSync(out, { recursive: true });
  for (const [i, p] of input.photos.entries()) {
    seed = name.length * 1000 + i * 7 + 1;
    const pal = p.palette;
    const blobs = Array.from({ length: 14 }, (_, k) => {
      const c = pal[k % pal.length];
      return `<ellipse cx="${rand() * 1200}" cy="${600 + rand() * 1000}" rx="${80 + rand() * 300}" ry="${60 + rand() * 220}" fill="${c}" opacity="${0.5 + rand() * 0.5}"/>`;
    }).join('');
    const lines = Array.from({ length: 6 }, () => `<rect x="${rand() * 1200}" y="${rand() * 1600}" width="${10 + rand() * 30}" height="${300 + rand() * 900}" fill="${pal[2] ?? pal[0]}" opacity="0.6"/>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600">
      <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal[3] ?? pal[0]}"/><stop offset="1" stop-color="${pal[0]}"/></linearGradient>
      <filter id="b"><feGaussianBlur stdDeviation="${18 + i * 4}"/></filter></defs>
      <rect width="1200" height="1600" fill="url(#s)"/><g filter="url(#b)">${blobs}${lines}</g>
      <circle cx="${300 + rand() * 600}" cy="${250 + rand() * 300}" r="${60 + rand() * 90}" fill="${pal[4] ?? '#fff'}" opacity="0.8" filter="url(#b)"/></svg>`;
    await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toFile(path.join(out, `${String(i + 1).padStart(2, '0')}.jpg`));
  }
  console.log(name, input.photos.length);
}
