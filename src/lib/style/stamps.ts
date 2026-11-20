// Марка сезона и штампы (план 20.11, B3): каждая бирка — из анализа или погоды, ничего случайного.
import type { DayAnalysis, StyleInput, StyleParams, StyleReason, Technique } from '@/lib/types';

const SEASON_RU: Record<DayAnalysis['season'], string> = { winter: 'зима', spring: 'весна', summer: 'лето', autumn: 'осень', unknown: 'день' };
const TIME_RU: Record<DayAnalysis['timeOfDay'], string> = { morning: 'утро', day: 'день', evening: 'вечер', night: 'ночь', unknown: '' };
const PLACE_RU: Partial<Record<DayAnalysis['setting'], string>> = { nature: 'на природе', city: 'в городе', indoor: 'дома', water: 'у воды', transport: 'в дороге' };
const PEOPLE_RU: Partial<Record<DayAnalysis['people'], string>> = { alone: 'наедине', pair: 'вдвоём', group: 'компанией' };
const MONTHS = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];

export const stampDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ''} ${iso.slice(0, 4)}`;

type Stamps = NonNullable<StyleParams['stamps']>;

export function buildStamps(input: StyleInput, primary: Technique): { stamps: Stamps; reason: StyleReason } {
  const a = input.analysis;
  const wx = input.weather;
  const tags: Stamps['tags'] = [];
  if (wx) {
    const sky = wx.snowfallCm >= 0.5 || (wx.precipitationMm >= 1 && wx.tempC <= 0) ? 'снег'
      : wx.precipitationMm >= 1 ? 'дождь' : wx.cloudCover >= 80 ? 'пасмурно' : wx.cloudCover <= 30 ? 'ясно' : 'облачно';
    tags.push({ kind: 'weather', text: `${Math.round(wx.tempC) < 0 ? '−' : ''}${Math.abs(Math.round(wx.tempC))}° · ${sky}` });
  } else {
    tags.push({ kind: 'weather', text: [SEASON_RU[a.season], TIME_RU[a.timeOfDay]].filter(Boolean).join(' · ') });
  }
  const place = PLACE_RU[a.setting];
  if (place) tags.push({ kind: 'place', text: place });
  const people = PEOPLE_RU[a.people];
  if (people) tags.push({ kind: 'people', text: people });

  const shape: Stamps['shape'] = primary === 'geometric' ? 'square' : primary === 'film' ? 'ticket' : 'circle';
  return {
    stamps: { shape, season: a.season, date: stampDate(input.date), tags },
    reason: {
      param: 'stamps',
      because: `Марка сезона и штампы из записи: ${tags.map((t) => t.text).join(', ')}; форма — ${shape === 'square' ? 'квадрат, как у геометрии' : shape === 'ticket' ? 'бумажный билет, как у плёнки' : 'круглая печать'}`,
    },
  };
}
