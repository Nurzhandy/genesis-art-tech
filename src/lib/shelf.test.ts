import { describe, expect, it } from 'vitest';
import { DIARY_KINDS, KIND_QUESTIONS, migrateShelf, NewDiaryInput, parseShelf } from './shelf';

describe('полка дневников', () => {
  it('читает список ключей и не падает на мусоре', () => {
    expect(parseShelf('["a","b"]')).toEqual(['a', 'b']);
    expect(parseShelf('{oops')).toEqual([]);
    expect(parseShelf(null)).toEqual([]);
    expect(parseShelf('[1,"a",null]')).toEqual(['a']);
  });
  it('старый одиночный ключ переезжает на полку без дублей', () => {
    expect(migrateShelf(null, 'old')).toEqual(['old']);
    expect(migrateShelf('["x"]', 'old')).toEqual(['x', 'old']);
    expect(migrateShelf('["old","x"]', 'old')).toEqual(['old', 'x']);
    expect(migrateShelf('["x"]', null)).toEqual(['x']);
  });
  it('новый дневник: название без лишних пробелов, до 60 символов, известный вид', () => {
    expect(NewDiaryInput.parse({ title: '  Путешествия  ', kind: 'travel' })).toEqual({ title: 'Путешествия', kind: 'travel' });
    expect(NewDiaryInput.safeParse({ title: 'я'.repeat(61), kind: 'travel' }).success).toBe(false);
    expect(NewDiaryInput.safeParse({ title: 'x', kind: 'diary' }).success).toBe(false);
    expect(NewDiaryInput.safeParse({ title: '   ', kind: 'work' }).success).toBe(false);
  });
  it('у каждого вида есть подпись, иконка, обложка и подсказка', () => {
    for (const k of Object.values(DIARY_KINDS)) {
      expect(k.label && k.icon && k.prompt && k.defaultTitle).toBeTruthy();
      expect(k.cover).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it('у каждого вида есть хотя бы 5 вопросов-подсказок, без повторов', () => {
    for (const list of Object.values(KIND_QUESTIONS)) {
      expect(list.length).toBeGreaterThanOrEqual(5);
      expect(new Set(list).size).toBe(list.length);
      for (const q of list) expect(q.endsWith('?')).toBe(true);
    }
  });
});
