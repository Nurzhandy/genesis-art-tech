import { describe, expect, it } from 'vitest';
import { slugify, validateTitle } from './validateTitle';

describe('validateTitle', () => {
  it('принимает название из 4 слов', () => {
    expect(validateTitle('Осенний парк и какао')).toEqual({ ok: true, title: 'Осенний парк и какао' });
  });
  it('принимает название из 5 слов', () => {
    expect(validateTitle('Ночь в офисе перед сдачей').ok).toBe(true);
  });
  it('отклоняет одно слово', () => {
    expect(validateTitle('Парк').ok).toBe(false);
  });
  it('отклоняет больше 7 слов', () => {
    expect(validateTitle('Очень длинный день в котором случилось всё сразу').ok).toBe(false);
  });
  it('чистит кавычки, точку и эмодзи', () => {
    expect(validateTitle('«Осенний парк и какао».')).toEqual({ ok: true, title: 'Осенний парк и какао' });
    expect(validateTitle('Осенний парк и какао 🍂')).toEqual({ ok: true, title: 'Осенний парк и какао' });
  });
  it('делает первую букву заглавной', () => {
    expect(validateTitle('первый снег у бабушки')).toEqual({ ok: true, title: 'Первый снег у бабушки' });
  });
});

describe('slugify', () => {
  it('транслитерирует русское название в латиницу через дефисы', () => {
    expect(slugify('Осенний парк и какао')).toBe('osenniy-park-i-kakao');
    expect(slugify('Ночь в офисе перед сдачей')).toBe('noch-v-ofise-pered-sdachey');
    expect(slugify('Щука, ёжик и Юля!')).toBe('shchuka-ezhik-i-yulya');
  });
  it('не возвращает пустую строку', () => {
    expect(slugify('🍂🍂')).toBe('den');
  });
});
