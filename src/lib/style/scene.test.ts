import { describe, expect, it } from 'vitest';
import { FIXTURES } from '@/lib/fixtures';
import { buildStyle } from './buildStyle';
import { buildScene } from './scene';

const input = (name: string) => FIXTURES.find((f) => f.name === name)!.input;

describe('режим «Рисунок»', () => {
  it('лето с друзьями на природе → солнце, птицы, пикник, компания', () => {
    const base = input('summer-friends');
    const { scene } = buildScene({ ...base, analysis: { ...base.analysis, setting: 'nature', timeOfDay: 'day', people: 'group', season: 'summer' } });
    expect(scene).toMatchObject({ sky: 'day', weather: 'clear', people: 3, picnic: true, birds: true });
  });
  it('ночь в офисе → ночь, комната или город, без птиц', () => {
    const { scene } = buildScene(input('office-night'));
    expect(scene.sky).toBe('night');
    expect(scene.birds).toBe(false);
  });
  it('дождь в записи → тучи и дождь, без пикника', () => {
    const { scene } = buildScene(input('rainy-alone'));
    expect(scene.weather).toBe('rain');
    expect(scene.picnic).toBe(false);
  });
  it('погода того дня важнее догадки: снегопад → снег', () => {
    const { scene } = buildScene({ ...input('autumn-park'), weather: { tempC: -4, precipitationMm: 2, snowfallCm: 3, cloudCover: 90 } });
    expect(scene.weather).toBe('snow');
  });
  it('какао в записи → чашка с паром; объяснение в «Почему так»', () => {
    const st = buildStyle(input('autumn-park'));
    expect(st.scene?.steam).toBe(true);
    expect(st.reasons.find((r) => r.param === 'scene')?.because).toMatch(/Рисунок дня/);
  });
});
