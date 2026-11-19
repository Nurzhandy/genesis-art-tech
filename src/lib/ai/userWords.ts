// Слова самого человека: подпись и сенсорные детали берём из записи, а не сочиняем (A10 / R1).
// Подпись и «заметки на полях» должны звучать голосом автора дневника, иначе это шаблонный AI.

const norm = (s: string) => s.toLocaleLowerCase('ru').replace(/ё/g, 'е');
const words = (s: string) => norm(s).match(/[\p{L}\p{N}]+/gu) ?? [];
/** Основа слова для склейки дублей. */
const stem = (w: string) => (w.length <= 4 ? w : w.slice(0, Math.max(4, w.length - 2)));

/** Одно слово в разных формах: «листья» ~ «листьях», «жёлтые» ~ «жёлтых». Отличаться может только окончание. */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= Math.max(3, Math.min(a.length, b.length) - 2);
}

const SHORT = new Set(['и', 'в', 'во', 'на', 'с', 'со', 'у', 'к', 'о', 'об', 'по', 'за', 'из', 'от', 'до', 'а', 'но', 'же', 'не', 'мы', 'я']);

/** Доля значимых слов фрагмента, которые есть в тексте (с точностью до окончаний). */
export function overlap(fragment: string, text: string): number {
  const pool = [...new Set(words(text))];
  const own = words(fragment).filter((w) => !SHORT.has(w));
  if (!own.length) return 0;
  return own.filter((w) => pool.some((t) => sameWord(w, t))).length / own.length;
}

/** Фрагмент из записи: 1–4 слова, почти все слова есть в тексте. */
export function isFromText(fragment: string, text: string, maxWords = 4): boolean {
  const n = words(fragment).length;
  return n >= 1 && n <= maxWords && overlap(fragment, text) >= 0.75;
}

/** Обрезает по границе слова, без многоточия посреди слова. */
export function cutAtWord(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const i = cut.lastIndexOf(' ');
  return (i > max * 0.5 ? cut.slice(0, i) : t.slice(0, max)).replace(/[,;:—–-]+$/u, '').trim();
}

// Слова, которые обычно и есть «атмосфера»: запахи, звуки, свет, погода, вкус, фактура.
const SENSORY = [
  'запах', 'пахл', 'аромат', 'звук', 'шум', 'шорох', 'шурш', 'тишин', 'смех', 'музык', 'песн', 'гитар', 'птиц', 'колокол',
  'свет', 'солнц', 'закат', 'рассвет', 'луч', 'огн', 'фонар', 'ламп', 'свеч', 'тень', 'туман', 'дожд', 'ливн', 'снег',
  'снеж', 'ветер', 'ветр', 'гроз', 'мороз', 'холод', 'тепл', 'жар', 'листь', 'лист', 'трав', 'цвет', 'мор', 'волн',
  'какао', 'кофе', 'чай', 'чая', 'глинтвейн', 'пирог', 'хлеб', 'мандарин', 'яблок', 'вкус', 'пар', 'плед', 'камин',
  'костр', 'пес', 'рук', 'щек', 'лужи', 'луж', 'мокр', 'кофт', 'шарф',
];
/** Слова-«опоры», за которыми обычно идёт сама деталь: «запах какао», «шум моря». */
const HEADS = ['запах', 'пахл', 'аромат', 'звук', 'шум', 'шорох', 'вкус', 'свет', 'огн', 'пар', 'смех'];

const isSensory = (w: string) => SENSORY.some((s) => norm(w).startsWith(s));

/** 2–3 сенсорные детали дословно из текста (для запасного анализа). */
export function sensoryFromText(text: string, max = 3): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const clause of text.split(/[.!?;\n,—–]+/u)) {
    const ws = clause.match(/[\p{L}\p{N}-]+/gu) ?? [];
    for (let i = 0; i < ws.length && out.length < max; i++) {
      if (!isSensory(ws[i])) continue;
      const head = HEADS.some((h) => norm(ws[i]).startsWith(h));
      // «запах какао» — опора + следующее слово; «жёлтых листьях» — прилагательное + слово.
      const prev = ws[i - 1] && !SHORT.has(norm(ws[i - 1])) && /(ый|ий|ой|ая|яя|ое|ее|ые|ие|ых|их|ом|ем|ую|юю)$/u.test(norm(ws[i - 1])) ? ws[i - 1] : null;
      const phrase = head && ws[i + 1] ? `${ws[i]} ${ws[i + 1]}` : prev ? `${prev} ${ws[i]}` : ws[i];
      const key = stem(norm(phrase.split(' ').pop()!));
      if (seen.has(key) || phrase.length < 3) continue;
      seen.add(key);
      out.push(phrase.toLocaleLowerCase('ru'));
      i += head ? 1 : 0;
    }
    if (out.length >= max) break;
  }
  return out;
}

/** Подпись из самой записи: короткая, самая «чувственная» фраза, строчными. */
export function captionFromText(text: string, max = 60): string {
  const clauses = text.split(/[.!?\n]+/u).map((c) => c.replace(/\s+/g, ' ').trim()).filter((c) => c.length > 3);
  if (!clauses.length) return 'просто день';
  const score = (c: string) => {
    const ws = words(c);
    const sens = ws.filter(isSensory).length;
    const fits = c.length <= max ? 1 : 0;
    return sens * 2 + fits * 1.5 - Math.abs(c.length - 40) / 40;
  };
  const best = [...clauses].sort((a, b) => score(b) - score(a))[0];
  return cutAtWord(best, max).toLocaleLowerCase('ru');
}
