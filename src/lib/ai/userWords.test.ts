import { describe, expect, it } from 'vitest';
import { userCaption, userSensory } from './analyzeDay';
import { fallbackAnalysis } from './fallback';
import { captionFromText, cutAtWord, isFromText, overlap, sensoryFromText } from './userWords';

const TEXT = 'Гуляли по парку, всё в жёлтых листьях. Было холодно, но мы пили какао и долго разговаривали.';

describe('слова пользователя (R1)', () => {
  it('фрагмент из текста узнаётся с точностью до окончаний', () => {
    expect(isFromText('жёлтых листьях', TEXT)).toBe(true);
    expect(isFromText('жёлтые листья', TEXT)).toBe(true);
    expect(isFromText('пили какао', TEXT)).toBe(true);
    expect(isFromText('запах хвои', TEXT)).toBe(false);          // выдумано
    expect(isFromText('мы долго гуляли по парку в листьях', TEXT)).toBe(false); // длиннее 4 слов
  });

  it('модельная сенсорика: выдуманное выбрасывается, нехватка добирается из текста', () => {
    const s = userSensory(['запах хвои', 'пили какао', 'Жёлтых листьях.'], TEXT);
    expect(s).toContain('пили какао');
    expect(s).toContain('жёлтых листьях');
    expect(s).not.toContain('запах хвои');
    expect(s.length).toBeLessThanOrEqual(4);
    for (const f of s) expect(isFromText(f, TEXT)).toBe(true);
  });

  it('подпись-пересказ заменяется фразой автора', () => {
    expect(userCaption('уютная прогулка в золотую осень', TEXT)).not.toContain('золотую');
    expect(overlap(userCaption('уютная прогулка в золотую осень', TEXT), TEXT)).toBeGreaterThan(0.9);
  });

  it('почти дословная подпись модели сохраняется', () => {
    expect(userCaption('«Было холодно, но мы пили какао».', TEXT)).toBe('было холодно, но мы пили какао');
  });

  it('подпись из текста короткая, строчная и не рвёт слова', () => {
    const c = captionFromText(TEXT);
    expect(c.length).toBeLessThanOrEqual(60);
    expect(c).toBe(c.toLocaleLowerCase('ru'));
    expect(TEXT.toLocaleLowerCase('ru')).toContain(c);
    expect(cutAtWord('один два три четыре пять', 12)).toBe('один два три');
    expect(captionFromText('')).toBe('просто день');
  });

  it('запасной анализ берёт сенсорику дословно из записи', () => {
    const s = sensoryFromText('Пахло мандаринами, за окном шёл снег. Запах какао и тихая музыка.');
    expect(s.length).toBeGreaterThanOrEqual(2);
    expect(s.length).toBeLessThanOrEqual(3);
    expect(s).toContain('запах какао');
    const a = fallbackAnalysis(TEXT, '2026-10-18', []);
    expect(a.sensory.length).toBeGreaterThanOrEqual(2);
    for (const f of a.sensory) expect(isFromText(f, TEXT)).toBe(true);
  });

  it('текст без деталей → пустая сенсорика, а не выдумки', () => {
    expect(sensoryFromText('норм день')).toEqual([]);
  });
});
