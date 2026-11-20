// Атмосферный слой (ресерч R3): листья, снег, дождь, пар, пыль в луче, огни — по правилу, с причиной.
import type { AtmosphereKind, StyleInput, StyleReason } from '@/lib/types';
import { soundscapeFor } from '@/lib/sound/recipes';
import { clamp01, round, signals } from './signals';

/** Слова дня: детали, сюжеты фото, слова настроения, подпись — разбитые на токены. */
function tokens(input: StyleInput): string[] {
  const a = input.analysis;
  return [...a.sensory, ...a.photoScenes.map((p) => p.subject), ...a.moodWords, a.caption]
    .join(' ')
    .toLocaleLowerCase('ru')
    .split(/[^а-яёa-z]+/u)
    .filter(Boolean);
}

const hasStem = (ts: string[], stems: string[]) => ts.find((t) => stems.some((s) => t.startsWith(s)));
const hasWord = (ts: string[], words: string[]) => ts.find((t) => words.includes(t));

export function buildAtmosphere(input: StyleInput): { atmosphere: { kind: AtmosphereKind; amount: number }; reason: StyleReason | null } {
  const s = signals(input);
  const a = input.analysis;
  const ts = tokens(input);
  let kind: AtmosphereKind = 'none';
  let why = '';
  let w: string | undefined;

  const wx = input.weather;
  const where = wx?.place ? ` (${wx.place})` : '';
  if (wx && (wx.snowfallCm >= 0.5 || (wx.precipitationMm >= 1 && wx.tempC <= 0))) {
    // Погода того дня важнее догадок по словам.
    kind = 'snow';
    why = `Погода того дня${where}: снег ${wx.snowfallCm >= 0.5 ? `${round(wx.snowfallCm, 1)} см` : `${round(wx.precipitationMm, 1)} мм при ${Math.round(wx.tempC)}°`} → падает снег`;
  } else if (wx && wx.precipitationMm >= 1) {
    kind = 'rain'; why = `Погода того дня${where}: дождь ${round(wx.precipitationMm, 1)} мм → капли дождя`;
  } else if ((w = hasStem(ts, ['дожд', 'ливн', 'ливен', 'морос']))) {
    kind = 'rain'; why = `В записи «${w}» → капли дождя`;
  } else if ((w = hasStem(ts, ['снег', 'снеж'])) || a.season === 'winter') {
    kind = 'snow'; why = w ? `В записи «${w}» → падает снег` : 'Зима → тихо падает снег';
  } else if ((w = hasStem(ts, ['листь', 'листв', 'листоп'])) || (a.season === 'autumn' && (a.setting === 'nature' || a.setting === 'water'))) {
    kind = 'leaves'; why = w ? `В записи «${w}» → падают листья` : `Осень ${a.setting === 'water' ? 'у воды' : 'на природе'} → падают листья`;
  } else if ((w = hasWord(ts, ['пар', 'пару', 'паром', 'какао', 'чай', 'чая', 'чаем', 'кофе', 'туман', 'тумане', 'тумана']))) {
    kind = 'mist'; why = `В записи «${w}» → в кадре плывёт тёплый пар`;
  } else if (s.night && (a.setting === 'city' || a.setting === 'indoor')) {
    kind = 'lights'; why = `Ночь ${a.setting === 'city' ? 'в городе' : 'за окном'} → размытые огни города`;
  } else if ((a.timeOfDay === 'morning' || a.timeOfDay === 'day') && s.warmLight) {
    kind = 'dust'; why = 'Тёплый дневной свет → пылинки в луче';
  }

  if (kind === 'none') return { atmosphere: { kind, amount: 0 }, reason: null };
  const amount = round(clamp01(0.3 + 0.5 * s.energy), 3);
  return {
    atmosphere: { kind, amount },
    reason: { param: 'atmosphere', because: `${why}, плотность ${amount} от энергии песни, скорость — от ${s.bpm} BPM; звук: ${soundscapeFor(kind).label}` },
  };
}
