import { describe, expect, it } from 'vitest';
import type { DayAnalysis, DayRecord, StyleInput } from '@/lib/types';
import { fallbackAnalysis } from '@/lib/ai/fallback';
import { generateDay, seedFromId, type GenerateDeps } from './generateDay';

const ID = '11111111-2222-3333-4444-555555555555';
const draft = (o: Partial<DayRecord> = {}): DayRecord => ({
  id: ID, diaryId: 'd1', date: '2026-10-18', title: null, slug: null, text: 'Гуляли по парку, пили какао',
  photos: [], song: { kind: 'file', path: 'd1/_draft-' + ID + '/song.mp3', title: 'Моя песня' },
  music: null, analysis: null, style: null, voice: null, posterPath: null, status: 'draft', error: null, createdAt: 'x', ...o,
});
const features = [{ index: 0, width: 10, height: 10, palette: ['#c8892b'], brightness: 0.6, warmth: 0.5, saturation: 0.5 }];
const analysis = (title = 'Осенний парк и какао'): DayAnalysis => ({ ...fallbackAnalysis('парк', '2026-10-18', features), title, source: 'claude' });

function fakeDeps(day: DayRecord, o: Partial<GenerateDeps> = {}) {
  const log = { statuses: [] as string[], moves: [] as [string, string][], puts: [] as string[], styleInput: null as StyleInput | null, final: null as DayRecord | null };
  let current = day;
  const deps: GenerateDeps = {
    getDay: async () => current,
    updateDay: async (_id, patch) => {
      if (patch.status) log.statuses.push(patch.status);
      current = { ...current, ...patch } as DayRecord;
      if (patch.status === 'ready') log.final = current;
      return current;
    },
    recentGenerations: async () => 0,
    slugTaken: async () => false,
    loadThumbs: async () => [{ base64: 'AAAA', mediaType: 'image/jpeg' }],
    analyze: async () => analysis(),
    resolveSong: async () => ({ song: { kind: 'link', url: 'u', provider: 'spotify' }, music: null }),
    buildStyle: (input) => { log.styleInput = input; return { seed: input.seed } as never; },
    moveFile: async (a, b) => { log.moves.push([a, b]); },
    putFile: async (p) => { log.puts.push(p); },
    limit: 30,
    ...o,
  };
  return { deps, log };
}

describe('generateDay', () => {
  it('черновик → generating → ready, файлы переезжают в папку с названием', async () => {
    const { deps, log } = fakeDeps(draft());
    const res = await generateDay(ID, { photoFeatures: features, music: null }, deps);
    expect(log.statuses).toEqual(['generating', 'ready']);
    expect(res.status).toBe('ready');
    expect(res.title).toBe('Осенний парк и какао');
    expect(res.slug).toBe('osenniy-park-i-kakao');
    expect(res.photos[0].path).toBe('d1/2026-10-18-osenniy-park-i-kakao/photos/01.jpg');
    expect(log.moves).toContainEqual([`d1/_draft-${ID}/photos/01.jpg`, 'd1/2026-10-18-osenniy-park-i-kakao/photos/01.jpg']);
    expect(log.moves).toContainEqual([`d1/_draft-${ID}/song.mp3`, 'd1/2026-10-18-osenniy-park-i-kakao/song.mp3']);
    expect(res.song.kind === 'file' && res.song.path).toBe('d1/2026-10-18-osenniy-park-i-kakao/song.mp3');
    for (const f of ['text.md', 'song.json', 'analysis.json', 'style.json'])
      expect(log.puts).toContain(`d1/2026-10-18-osenniy-park-i-kakao/${f}`);
  });
  it('seed стиля стабилен и выводится из id дня', async () => {
    const { deps, log } = fakeDeps(draft());
    await generateDay(ID, { photoFeatures: features, music: null }, deps);
    expect(log.styleInput?.seed).toBe(seedFromId(ID));
    expect(seedFromId(ID)).toBe(seedFromId(ID));
    expect(seedFromId(ID)).not.toBe(seedFromId('other'));
  });
  it('если такое название уже есть в дневнике, добавляется -2', async () => {
    const { deps } = fakeDeps(draft(), { slugTaken: async (_d, slug) => slug === 'osenniy-park-i-kakao' });
    const res = await generateDay(ID, { photoFeatures: features, music: null }, deps);
    expect(res.slug).toBe('osenniy-park-i-kakao-2');
  });
  it('повторный вызов во время генерации → 409', async () => {
    const { deps } = fakeDeps(draft({ status: 'generating' }));
    await expect(generateDay(ID, { photoFeatures: features, music: null }, deps)).rejects.toMatchObject({ status: 409 });
  });
  it('готовый день возвращается как есть (идемпотентность)', async () => {
    const ready = draft({ status: 'ready', title: 'X y z' });
    const { deps, log } = fakeDeps(ready);
    expect(await generateDay(ID, { photoFeatures: features, music: null }, deps)).toBe(ready);
    expect(log.statuses).toEqual([]);
  });
  it('лимит генераций в сутки → 429', async () => {
    const { deps } = fakeDeps(draft(), { recentGenerations: async () => 30 });
    await expect(generateDay(ID, { photoFeatures: features, music: null }, deps)).rejects.toMatchObject({ status: 429 });
  });
  it('исключение в середине → статус error с текстом, можно повторить', async () => {
    const { deps, log } = fakeDeps(draft(), { moveFile: async () => { throw new Error('storage down'); } });
    await expect(generateDay(ID, { photoFeatures: features, music: null }, deps)).rejects.toMatchObject({ status: 500 });
    expect(log.statuses).toEqual(['generating', 'error']);
  });
  it('день со статусом error можно сгенерировать заново', async () => {
    const { deps, log } = fakeDeps(draft({ status: 'error', error: 'x' }));
    await generateDay(ID, { photoFeatures: features, music: null }, deps);
    expect(log.statuses).toEqual(['generating', 'ready']);
  });
  it('ссылка без названия разрешается на сервере; музыка из файла важнее', async () => {
    let resolved = false;
    const { deps, log } = fakeDeps(draft({ song: { kind: 'link', url: 'https://open.spotify.com/track/x', provider: 'spotify' } }), {
      resolveSong: async () => { resolved = true; return { song: { kind: 'link', url: 'u', provider: 'spotify', title: 'T', artist: 'A' }, music: { source: 'deezer', bpm: 100, energy: 0.5, mode: 'unknown' } }; },
    });
    await generateDay(ID, { photoFeatures: features, music: null }, deps);
    expect(resolved).toBe(true);
    expect(log.styleInput?.music.source).toBe('deezer');
    expect(log.final?.song).toMatchObject({ title: 'T', artist: 'A' });
  });
});
