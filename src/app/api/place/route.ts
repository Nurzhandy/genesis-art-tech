// Место по координатам фото: «Павлодар, Иртыш». Обратное геокодирование OpenStreetMap (Nominatim),
// координаты округляются до ~1 км — точный адрес человека никуда не уходит.
import type { NextRequest } from 'next/server';
import { handle, HttpError } from '@/lib/http';
import { placeLabel, type OsmAddress } from '@/lib/place';

export const GET = handle(async (req: NextRequest) => {
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lon = Number(req.nextUrl.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new HttpError(400, 'Нужны координаты');
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&addressdetails=1&accept-language=ru&lat=${r2(lat)}&lon=${r2(lon)}`;
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'atmosphere-diary/1.0 (hackathon prototype)' }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return Response.json({ place: null });
    const body = (await res.json()) as OsmAddress;
    return Response.json({ place: placeLabel(body) }, { headers: { 'cache-control': 'public, max-age=86400' } });
  } catch {
    return Response.json({ place: null });
  }
});
