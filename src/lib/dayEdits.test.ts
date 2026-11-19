import { describe, expect, it } from 'vitest';
import type { DayRecord } from '@/lib/types';
import { FIXTURES } from './fixtures';
import { buildStyle } from './style/buildStyle';
import { hexToOklch } from './style/color';
import { deleteDay, MoodOverrideInput, renameDay, restyle, type RenameDeps } from './dayEdits';
import { seedFromId } from './generateDay';
import { assertCanEdit, DIARY_KEY_HEADER } from './db';
import { HttpError } from './http';

const ID = '11111111-2222-3333-4444-555555555555';
const F = 'd1/2026-10-18-osenniy-park-i-kakao';
const autumn = FIXTURES.find((f) => f.name === 'autumn-park')!.input;

const ready = (o: Partial<DayRecord> = {}): DayRecord => ({
  id: ID, diaryId: 'd1', date: '2026-10-18', title: 'Осенний парк и какао', slug: 'osenniy-park-i-kakao', text: 'Гуляли по парку',
  photos: autumn.photos.map((features, i) => ({ path: `${F}/photos/0${i + 1}.jpg`, thumbPath: `${F}/photos/thumb/0${i + 1}.jpg`, features })),
  song: { kind: 'file', path: `${F}/song.mp3` }, music: autumn.music, analysis: autumn.analysis, style: null,
  voice: { path: `${F}/voice.mp3`, preset: { voice: 'nova', speed: 1, instructions: '', because: '' } },
  posterPath: `${F}/memory.jpg`, status: 'ready', error: null, createdAt: 'x', ...o,
});

const avgHue = (hexes: string[]) => hexes.map((h) => hexToOklch(h)).reduce((a, c) => a + c.c * Math.cos(((c.h - 60) * Math.PI) / 180), 0) / hexes.length;

describe('restyle — «Не совсем так?» (R10)', () => {
  it('ноль → ровно стиль системы, без поправки', () => {
    const r = restyle(ready(), { warmth: 0, energy: 0 }, buildStyle);
    expect(r.moodOverride).toBeNull();
    expect(r.style).toEqual(buildStyle({ ...autumn, seed: seedFromId(ID) }));
  });

  it('«живее» ускоряет ритм кадров, «спокойнее» замедляет', () => {
    const fast = restyle(ready(), { warmth: 0, energy: 0.4 }, buildStyle).style;
    const slow = restyle(ready(), { warmth: 0, energy: -0.4 }, buildStyle).style;
    expect(fast.motion.beatsPerPhoto).toBeLessThan(slow.motion.beatsPerPhoto);
    expect(fast.composition.negativeSpace).toBeLessThan(slow.composition.negativeSpace);
  });

  it('«холоднее» уводит акценты от тёплого тона', () => {
    const warm = restyle(ready(), { warmth: 0.3, energy: 0 }, buildStyle).style;
    const cold = restyle(ready(), { warmth: -0.4, energy: 0 }, buildStyle).style;
    expect(avgHue(warm.palette.accents)).toBeGreaterThan(avgHue(cold.palette.accents));
  });

  it('поправка объясняется первой строкой «Почему так» и применяется один раз', () => {
    const r = restyle(ready(), { warmth: 0.2, energy: -0.1 }, buildStyle);
    expect(r.moodOverride).toEqual({ warmth: 0.2, energy: -0.1 });
    expect(r.style.reasons[0].because).toContain('теплее на 0.2 и спокойнее на 0.1');
    expect(r.style.reasons.filter((x) => /Вы сделали день/.test(x.because))).toHaveLength(1);
  });

  it('сохранённый стиль совпадает с живым превью в браузере', () => {
    const o = { warmth: -0.25, energy: 0.15 };
    expect(restyle(ready(), o, buildStyle).style).toEqual(buildStyle({ ...autumn, seed: seedFromId(ID), moodOverride: o }));
  });

  it('сдвиг больше ±0.4 не принимается', () => {
    expect(MoodOverrideInput.safeParse({ warmth: 0.5, energy: 0 }).success).toBe(false);
    expect(MoodOverrideInput.safeParse({ warmth: -0.4, energy: 0.4 }).success).toBe(true);
  });

  it('несобранный день перенастроить нельзя', () => {
    expect(() => restyle(ready({ status: 'generating' }), { warmth: 0.1, energy: 0 }, buildStyle)).toThrow(HttpError);
  });
});

function renameDeps(files: string[], taken: string[] = []) {
  const log = { moves: [] as [string, string][], puts: [] as [string, string][], patch: null as Record<string, unknown> | null };
  const deps: RenameDeps = {
    slugTaken: async (_d, slug) => taken.includes(slug),
    listFolder: async () => files.map((path) => ({ path, size: 1 })),
    moveFile: async (a, b) => { log.moves.push([a, b]); },
    putFile: async (p, body) => { log.puts.push([p, body]); },
    updateDay: async (_id, patch) => { log.patch = patch; return { ...ready(), ...patch } as DayRecord; },
  };
  return { deps, log };
}

describe('renameDay (R11)', () => {
  const files = [`${F}/photos/01.jpg`, `${F}/photos/thumb/01.jpg`, `${F}/song.mp3`, `${F}/memory.jpg`, `${F}/voice.mp3`, `${F}/text.md`];
  const NEW = 'd1/2026-10-18-kakao-v-zheltom-parke';

  it('название по правилам, папка переезжает целиком, пути обновляются', async () => {
    const { deps, log } = renameDeps(files);
    await renameDay(ready(), '«Какао в жёлтом парке».', deps);
    expect(log.moves).toContainEqual([`${F}/photos/thumb/01.jpg`, `${NEW}/photos/thumb/01.jpg`]);
    expect(log.moves).toHaveLength(files.length);
    expect(log.patch).toMatchObject({ title: 'Какао в жёлтом парке', slug: 'kakao-v-zheltom-parke', poster_path: `${NEW}/memory.jpg` });
    expect((log.patch!.photos as DayRecord['photos'])[0].path).toBe(`${NEW}/photos/01.jpg`);
    expect((log.patch!.song as { path: string }).path).toBe(`${NEW}/song.mp3`);
    expect((log.patch!.voice as { path: string }).path).toBe(`${NEW}/voice.mp3`);
    expect(log.puts[0]).toEqual([`${NEW}/text.md`, expect.stringContaining('# Какао в жёлтом парке')]);
  });

  it('занятое имя папки получает суффикс -2', async () => {
    const { deps, log } = renameDeps(files, ['kakao-v-zheltom-parke']);
    await renameDay(ready(), 'Какао в жёлтом парке', deps);
    expect(log.patch).toMatchObject({ slug: 'kakao-v-zheltom-parke-2' });
  });

  it('название не по правилам → 400 и ничего не двигаем', async () => {
    const { deps, log } = renameDeps(files);
    await expect(renameDay(ready(), 'Парк', deps)).rejects.toMatchObject({ status: 400 });
    expect(log.moves).toHaveLength(0);
  });

  it('то же название → без изменений', async () => {
    const { deps, log } = renameDeps(files);
    await renameDay(ready(), 'Осенний парк и какао', deps);
    expect(log.patch).toBeNull();
  });
});

describe('deleteDay (R14)', () => {
  it('удаляет файлы папки и черновика, затем строку', async () => {
    const order: string[] = [];
    await deleteDay(ready(), {
      listFolder: async (f) => (f === F ? [{ path: `${F}/text.md`, size: 1 }] : [{ path: `d1/_draft-${ID}/photos/01.jpg`, size: 1 }]),
      removeFiles: async (p) => { order.push(`remove:${p.join(',')}`); },
      deleteRow: async (id) => { order.push(`row:${id}`); },
    });
    expect(order).toEqual([`remove:${F}/text.md,d1/_draft-${ID}/photos/01.jpg`, `row:${ID}`]);
  });
});

describe('assertCanEdit', () => {
  const req = (key?: string) => new Request('http://x', { headers: key ? { [DIARY_KEY_HEADER]: key } : {} });
  it('владелец может, чужой и без ключа — нет, демо — только чтение', () => {
    expect(() => assertCanEdit(req('d1'), ready())).not.toThrow();
    expect(() => assertCanEdit(req('d2'), ready())).toThrow('владелец');
    expect(() => assertCanEdit(req(), ready())).toThrow(HttpError);
    expect(() => assertCanEdit(req('demo'), ready({ diaryId: 'demo' }))).toThrow('Демо');
  });
});
