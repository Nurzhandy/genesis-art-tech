import { describe, expect, it } from 'vitest';
import { placeLabel } from './place';

describe('место по фото', () => {
  it('город и река рядом: «Павлодар, Иртыш»', () => {
    expect(placeLabel({ type: 'river', name: 'Иртыш', address: { city: 'Павлодар', state: 'Павлодарская область' } })).toBe('Павлодар, Иртыш');
  });
  it('только город, если рядом нет приметного места', () => {
    expect(placeLabel({ type: 'residential', name: 'улица Ленина', address: { town: 'Экибастуз' } })).toBe('Экибастуз');
  });
  it('парк из адреса', () => {
    expect(placeLabel({ address: { city: 'Астана', park: 'Центральный парк' } })).toBe('Астана, Центральный парк');
  });
  it('пустой ответ — null', () => {
    expect(placeLabel({})).toBeNull();
  });
});
