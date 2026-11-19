// Правила названий папок дня: 3–7 слов, один тон, без кавычек и эмодзи (A3).

export type TitleCheck = { ok: true; title: string } | { ok: false; reason: string };

export function cleanTitle(raw: string): string {
  return raw
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
    .replace(/[«»"“”„'`]/g, '')
    .replace(/[.!?…;:]+\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateTitle(raw: string): TitleCheck {
  const t = cleanTitle(raw);
  const words = t.split(' ').filter(Boolean);
  if (words.length < 3) return { ok: false, reason: 'меньше 3 слов' };
  if (words.length > 7) return { ok: false, reason: 'больше 7 слов' };
  if (!/\p{L}/u.test(t)) return { ok: false, reason: 'нет букв' };
  return { ok: true, title: t.charAt(0).toLocaleUpperCase('ru') + t.slice(1) };
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ә: 'a', ғ: 'g', қ: 'q', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
};

export function slugify(title: string): string {
  const s = [...title.toLocaleLowerCase('ru')]
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return s || 'den';
}
