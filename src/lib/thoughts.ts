// Хранилище мыслей (по мотивам mymind): мысль, цитата, ссылка или идея — без дня, фото и песни.
// Метка ставится сама по виду записи; всё лежит только на этом устройстве (localStorage).

export type ThoughtKind = 'link' | 'quote' | 'idea' | 'plan' | 'feeling' | 'note';
export interface Thought { id: string; text: string; kind: ThoughtKind; at: string }

export const KIND_LOOK: Record<ThoughtKind, { label: string; color: string }> = {
  link: { label: 'ссылка', color: '#5b7fd1' },
  quote: { label: 'цитата', color: '#a0522d' },
  idea: { label: 'идея', color: '#e0a030' },
  plan: { label: 'план', color: '#2f6f73' },
  feeling: { label: 'чувство', color: '#c8577a' },
  note: { label: 'мысль', color: '#6b6b6b' },
};

/** Вид записи — по самому тексту, без AI: ссылка, цитата в кавычках, «идея», «надо/хочу», чувство. */
export function kindOf(text: string): ThoughtKind {
  const t = text.trim().toLocaleLowerCase('ru');
  if (/^https?:\/\/\S+$/.test(t) || /^www\.\S+$/.test(t)) return 'link';
  if (/^[«"“„].+[»"”]/.test(text.trim()) || /^—\s/.test(text.trim())) return 'quote';
  if (/^(идея|а что если|придумал|придумала)/.test(t)) return 'idea';
  if (/^(надо|нужно|хочу|не забыть|завтра|план)/.test(t)) return 'plan';
  if (/(чувствую|мне (грустно|радостно|страшно|спокойно|тревожно)|скучаю|люблю)/.test(t)) return 'feeling';
  return 'note';
}

export function newThought(text: string, now = new Date()): Thought {
  return { id: `${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`, text: text.trim().slice(0, 2000), kind: kindOf(text), at: now.toISOString() };
}

export function searchThoughts(list: Thought[], q: string, kind: ThoughtKind | 'all' = 'all'): Thought[] {
  const s = q.trim().toLocaleLowerCase('ru');
  return list.filter((t) => (kind === 'all' || t.kind === kind) && (!s || t.text.toLocaleLowerCase('ru').includes(s)));
}

export const THOUGHTS_KEY = 'atmosphere-thoughts';
export function parseThoughts(raw: string | null | undefined): Thought[] {
  try { const v = JSON.parse(raw ?? '[]'); return Array.isArray(v) ? v.filter((t) => t && typeof t.text === 'string') : []; } catch { return []; }
}
