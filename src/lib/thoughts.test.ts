import { describe, expect, it } from 'vitest';
import { kindOf, newThought, parseThoughts, searchThoughts } from './thoughts';

describe('хранилище мыслей', () => {
  it('метка ставится сама по виду записи', () => {
    expect(kindOf('https://example.com/article')).toBe('link');
    expect(kindOf('«Всё будет хорошо» — бабушка')).toBe('quote');
    expect(kindOf('Идея: дневник для кота')).toBe('idea');
    expect(kindOf('Не забыть позвонить маме')).toBe('plan');
    expect(kindOf('Скучаю по морю')).toBe('feeling');
    expect(kindOf('Сегодня небо было зелёным')).toBe('note');
  });
  it('поиск по тексту и метке', () => {
    const list = [newThought('Идея: фильм из всех осенних дней'), newThought('Купить плёнку'), newThought('https://x.y')];
    expect(searchThoughts(list, 'осен')).toHaveLength(1);
    expect(searchThoughts(list, '', 'link')).toHaveLength(1);
  });
  it('битые данные из хранилища не ломают страницу', () => {
    expect(parseThoughts('не json')).toEqual([]);
    expect(parseThoughts(null)).toEqual([]);
  });
});
