import { describe, expect, it } from 'vitest';
import { layerReasons } from './DayLayers';

const reasons = [
  { param: 'palette', because: 'палитра из фото' },
  { param: 'feeling', because: 'вы отметили «уют»' },
  { param: 'technique', because: 'мазки Моне' },
  { param: 'scene', because: 'парк с деревьями' },
  { param: 'atmosphere', because: 'падают листья' },
];

describe('layerReasons', () => {
  it('берёт причины слоя по порядку важности: чувство человека раньше палитры', () => {
    expect(layerReasons('paper', reasons)).toEqual(['вы отметили «уют»', 'палитра из фото']);
  });
  it('сцена «Рисунка» — только в режиме рисунка', () => {
    expect(layerReasons('technique', reasons)).toEqual(['мазки Моне']);
    expect(layerReasons('technique', reasons, 'drawing')).toEqual(['парк с деревьями', 'мазки Моне']);
  });
  it('нет причин — понятная подпись слоя', () => {
    expect(layerReasons('grain', reasons)[0]).toMatch(/зерно/i);
  });
});
