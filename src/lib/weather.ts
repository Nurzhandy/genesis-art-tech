// Погода того дня (план 20.11, A1): Open-Meteo без ключа. Город → координаты → дневные значения.
// Любой сбой → null: погода только уточняет атмосферу, день без неё собирается как раньше.
import type { DayWeather } from './types';

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 5000;
/** Архив Open-Meteo отстаёт на несколько дней — свежие даты берём из прогноза с прошлыми днями. */
const ARCHIVE_LAG_DAYS = 6;
const DAILY = 'temperature_2m_mean,precipitation_sum,snowfall_sum,cloud_cover_mean';

const r1 = (v: number) => Math.round(v * 10) / 10;

async function getJson(url: string, fetcher: Fetcher): Promise<unknown> {
  try {
    const res = await fetcher(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: 'application/json' } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function geocode(place: string, fetcher: Fetcher = fetch): Promise<{ lat: number; lon: number; name: string } | null> {
  const q = place.trim();
  if (!q) return null;
  const body = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&language=ru&count=1&format=json`, fetcher);
  const hit = (body as { results?: { name?: string; latitude?: number; longitude?: number }[] } | null)?.results?.[0];
  if (!hit || typeof hit.latitude !== 'number' || typeof hit.longitude !== 'number') return null;
  return { lat: hit.latitude, lon: hit.longitude, name: hit.name ?? q };
}

export function weatherUrl(lat: number, lon: number, date: string, now = new Date()): string {
  const ageDays = (now.getTime() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000;
  const host = ageDays > ARCHIVE_LAG_DAYS ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';
  return `${host}?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&daily=${DAILY}&timezone=auto`;
}

export function parseDaily(body: unknown): Omit<DayWeather, 'place'> | null {
  const d = (body as { daily?: Record<string, (number | null)[]> } | null)?.daily;
  const first = (k: string) => {
    const v = d?.[k]?.[0];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  const tempC = first('temperature_2m_mean');
  if (tempC === null) return null;
  return {
    tempC: r1(tempC),
    precipitationMm: r1(Math.max(0, first('precipitation_sum') ?? 0)),
    snowfallCm: r1(Math.max(0, first('snowfall_sum') ?? 0)),
    cloudCover: Math.round(Math.min(100, Math.max(0, first('cloud_cover_mean') ?? 50))),
  };
}

export async function dayWeather(lat: number, lon: number, date: string, fetcher: Fetcher = fetch): Promise<Omit<DayWeather, 'place'> | null> {
  return parseDaily(await getJson(weatherUrl(lat, lon, date), fetcher));
}

/** Город, как его ввёл человек, и дата дня → погода. Без города сеть не трогаем. */
export async function weatherFor(place: string | null | undefined, date: string, fetcher: Fetcher = fetch): Promise<DayWeather | null> {
  if (!place?.trim()) return null;
  const geo = await geocode(place, fetcher);
  if (!geo) return null;
  const w = await dayWeather(geo.lat, geo.lon, date, fetcher);
  return w ? { ...w, place: geo.name } : null;
}
