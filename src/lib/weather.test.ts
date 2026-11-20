import { describe, expect, it, vi } from 'vitest';
import { dayWeather, geocode, parseDaily, weatherFor, weatherUrl } from './weather';

const GEO = { results: [{ name: 'Астана', latitude: 51.18, longitude: 71.45, country: 'Казахстан' }] };
const DAILY = {
  daily: {
    time: ['2026-10-18'],
    temperature_2m_mean: [3.44],
    precipitation_sum: [4.2],
    snowfall_sum: [0],
    cloud_cover_mean: [87.6],
  },
};

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe('погода дня (Open-Meteo)', () => {
  it('разбирает дневные значения и округляет', () => {
    expect(parseDaily(DAILY)).toEqual({ tempC: 3.4, precipitationMm: 4.2, snowfallCm: 0, cloudCover: 88 });
  });

  it('пустой или битый ответ → null', () => {
    expect(parseDaily({})).toBeNull();
    expect(parseDaily({ daily: { time: ['2026-10-18'], temperature_2m_mean: [null] } })).toBeNull();
  });

  it('старые даты — archive, последние дни — forecast', () => {
    const now = new Date('2026-11-20T12:00:00Z');
    expect(weatherUrl(51, 71, '2026-10-18', now)).toContain('archive-api.open-meteo.com');
    expect(weatherUrl(51, 71, '2026-11-18', now)).toContain('api.open-meteo.com/v1/forecast');
    expect(weatherUrl(51, 71, '2026-11-20', now)).toContain('start_date=2026-11-20');
  });

  it('город → координаты', async () => {
    const fetcher = vi.fn(() => ok(GEO));
    expect(await geocode('Астана', fetcher)).toEqual({ lat: 51.18, lon: 71.45, name: 'Астана' });
    expect(String((fetcher.mock.calls[0] as unknown[])[0])).toContain('name=%D0%90%D1%81%D1%82%D0%B0%D0%BD%D0%B0');
  });

  it('неизвестный город → null', async () => {
    expect(await geocode('Ыыыыы', () => ok({}))).toBeNull();
  });

  it('сбой сети → null, а не ошибка', async () => {
    const boom = () => Promise.reject(new Error('offline'));
    expect(await geocode('Астана', boom)).toBeNull();
    expect(await dayWeather(51, 71, '2026-10-18', boom)).toBeNull();
    expect(await weatherFor('Астана', '2026-10-18', boom)).toBeNull();
  });

  it('город и дата → погода с подписью места', async () => {
    const fetcher = vi.fn((url: string) => ok(url.includes('geocoding') ? GEO : DAILY));
    expect(await weatherFor('  астана ', '2026-10-18', fetcher)).toEqual({
      tempC: 3.4, precipitationMm: 4.2, snowfallCm: 0, cloudCover: 88, place: 'Астана',
    });
  });

  it('без города погоды нет и сеть не трогаем', async () => {
    const fetcher = vi.fn(() => ok(GEO));
    expect(await weatherFor('', '2026-10-18', fetcher)).toBeNull();
    expect(await weatherFor(null, '2026-10-18', fetcher)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
