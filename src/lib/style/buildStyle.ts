// Движок правил визуальной системы: StyleInput → StyleParams с причинами.
// Чистая детерминированная функция — один и тот же день всегда выглядит одинаково.
import type { StyleInput, StyleParams, StyleReason, Technique } from '@/lib/types';
import { buildAtmosphere } from './atmosphere';
import { buildSongObject } from './songObject';
import { buildVisual } from './visual';
import { buildMotion, photoInterval } from './motion';
import { buildStamps } from './stamps';
import { buildPalette } from './palette';
import { clamp01, round, signals } from './signals';
import { pickTechniques, scoreTechniques, TECHNIQUE_NAMES } from './techniques';

const FRAME: Record<Technique, StyleParams['composition']['photoFrame']> = {
  impressionist: 'soft', geometric: 'hard', collage: 'torn', minimal: 'none', film: 'hard',
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function buildStyle(input: StyleInput): StyleParams {
  const s = signals(input);
  const { analysis: a } = input;
  const techniques = pickTechniques(scoreTechniques(input));
  const { palette, warmShift, coolShift, dark } = buildPalette(input);
  const { motion, durationSec } = buildMotion(input, input.photos.length);

  const negativeSpace = round(clamp01(0.2 + 0.5 * (1 - s.arousal) + 0.1 * (s.minor ? 1 : 0)));
  const grain = round(clamp01(0.12 + 0.5 * s.nostalgia + 0.2 * (s.year !== null && s.year < 1990 ? 1 : 0)));
  const titleWeight: 400 | 600 | 700 = s.tension > 0.6 ? 700 : s.arousal < 0.3 ? 400 : 600;
  const tilt = ((input.seed % 13) - 6) * (0.3 + s.arousal);

  const reasons: StyleReason[] = [];
  const t = techniques;
  reasons.push({
    param: 'technique',
    because:
      `Основная техника — ${TECHNIQUE_NAMES[t.primary]} (${pct(t.scores[t.primary])} совпадения): ` +
      techniqueWhy(t.primary, input) +
      (t.secondary ? `. Поверх — ${TECHNIQUE_NAMES[t.secondary]} на ${pct(t.mix)}` : ''),
  });
  reasons.push({
    param: 'palette',
    because:
      `Палитра собрана из цветов ваших фото` +
      (warmShift > 0.05 ? `, сдвинута к теплу на ${pct(warmShift)} (радость ${round(s.valence, 2)}${s.warmLight ? ', тёплый свет' : ''})` : '') +
      (coolShift > 0.05 ? `, к холоду на ${pct(coolShift)} (${s.night ? 'ночь' : 'напряжение'} ${round(s.tension, 2)})` : '') +
      (s.minor ? ', приглушена минором' : '') +
      (a.season !== 'unknown' ? `, с оттенком сезона (${seasonRu(a.season)})` : '') +
      (dark ? '; тёмная бумага — день прошёл в темноте или на нервах' : ''),
  });
  reasons.push({
    param: 'motion',
    because:
      `${s.bpm} BPM, энергия дня ${round(s.arousal, 2)} (запись ${round(s.textArousal, 2)}, песня ${round(s.energy, 2)}) — ` +
      `${s.arousal > 0.6 ? 'много энергии' : s.arousal > 0.3 ? 'средний темп' : 'спокойно'} → ` +
      `кадр держится ${motion.beatsPerPhoto} долей ≈ ${round(photoInterval(motion), 1)} с, ` +
      `переходы ${motion.easing === 'sharp' ? 'резкие, точно в долю' : 'мягкие'}`,
  });
  reasons.push({
    param: 'negativeSpace',
    because: `Пустого пространства ${pct(negativeSpace)}: ${s.arousal < 0.4 ? 'тихому дню нужен воздух' : 'насыщенный день заполняет кадр'}${s.minor ? ', минор добавляет пустоты' : ''}`,
  });
  reasons.push({
    param: 'grain',
    because: `Зерно ${pct(grain)}: ностальгия ${round(s.nostalgia, 2)}${s.year ? `, песня ${s.year} года` : ''}${s.year !== null && s.year < 1990 ? ' — как старая плёнка' : ''}`,
  });
  if (s.genre) reasons.push({ param: 'genre', because: `Жанр «${s.genre}» сдвигает выбор техники: ${genreHint(s.genre)}` });
  if (s.warmthOverride || s.energyOverride) {
    const parts = [
      s.warmthOverride ? `${s.warmthOverride > 0 ? 'теплее' : 'холоднее'} на ${round(Math.abs(s.warmthOverride), 2)}` : '',
      s.energyOverride ? `${s.energyOverride > 0 ? 'живее' : 'спокойнее'} на ${round(Math.abs(s.energyOverride), 2)}` : '',
    ].filter(Boolean);
    reasons.unshift({ param: 'override', because: `Вы сделали день ${parts.join(' и ')} — палитра и ритм пересчитаны по тем же правилам` });
  }
  const wx = input.weather;
  if (wx) {
    const effects = [
      wx.tempC <= -5 ? 'мороз холодит палитру' : wx.tempC >= 25 ? 'жара греет палитру' : '',
      wx.cloudCover >= 80 ? 'пасмурно — цвета приглушены' : '',
    ].filter(Boolean);
    reasons.push({
      param: 'weather',
      because: `Погода того дня${wx.place ? ` (${wx.place})` : ''}: ${Math.round(wx.tempC)}°, облачность ${Math.round(wx.cloudCover)}%${wx.precipitationMm >= 1 ? `, осадки ${round(wx.precipitationMm, 1)} мм` : ''}${effects.length ? ` → ${effects.join(', ')}` : ''}`,
    });
  }
  if (input.music.coverPalette?.length) {
    reasons.push({ param: 'cover', because: 'Цвета обложки альбома подмешаны в акценты на 12% — песня окрашивает день' });
  }
  const { stamps, reason: stampsReason } = buildStamps(input, t.primary);
  reasons.push(stampsReason);
  const { atmosphere, reason: atmosphereReason } = buildAtmosphere(input);
  if (atmosphereReason) reasons.push(atmosphereReason);
  const { visual, reasons: visualReasons } = buildVisual(input);
  const { songObject, reason: songObjectReason } = buildSongObject(input);
  reasons.push(songObjectReason, ...visualReasons);
  if (s.energy > 0.6 || s.energy < 0.3)
    reasons.push({ param: 'jitter', because: `Энергия песни ${round(s.energy, 2)} → ${s.energy > 0.6 ? 'фигуры и мазки дрожат и пульсируют' : 'движение почти неподвижное'}` });

  return {
    version: 1,
    seed: input.seed,
    techniques: t,
    palette,
    texture: {
      grain,
      paper: round(clamp01(0.25 + 0.35 * (1 - s.arousal) + 0.2 * s.nostalgia)),
      brush: round(clamp01(t.scores.impressionist)),
    },
    composition: {
      density: round(1 - negativeSpace),
      negativeSpace,
      asymmetry: round(clamp01(0.2 + 0.5 * s.tension + 0.3 * s.arousal)),
      photoFrame: FRAME[t.primary],
    },
    motion,
    typography: { titleWeight, captionTilt: round(Math.max(-6, Math.min(6, tilt)), 2) },
    durationSec,
    atmosphere,
    songObject,
    visual,
    stamps,
    reasons,
  };
}

function techniqueWhy(tech: Technique, input: StyleInput): string {
  const s = signals(input);
  const a = input.analysis;
  switch (tech) {
    case 'impressionist':
      return `спокойный светлый день${a.setting === 'nature' || a.setting === 'water' ? ' на природе' : ''} — мазок растворяет контуры, остаётся ощущение света`;
    case 'geometric':
      return `напряжение ${round(s.tension, 2)} и энергия ${round(s.arousal, 2)}${s.night ? ', ночь' : ''} — жёсткая сетка, линии и пятна держат ритм`;
    case 'minimal':
      return `тихий день${a.people === 'alone' ? ' наедине с собой' : ''} — пустота даёт воздух, внимание на одном кадре`;
    case 'film':
      return `ностальгия ${round(s.nostalgia, 2)}${s.year && s.year < 2000 ? ` и песня ${s.year} года` : ''} — зерно и засветки звучат как «это было давно и дорого»`;
    case 'collage':
      return `насыщенный день${a.people === 'group' ? ' с друзьями' : ''}, ${input.photos.length} фото — наложения передают «всего было много и сразу»`;
  }
}

function genreHint(genre: string): string {
  if (/jazz|swing|classical|folk/.test(genre)) return 'живые инструменты тянут к мазкам импрессионистов';
  if (/electronic|techno|house|drum/.test(genre)) return 'электроника тянет к геометрии и резкому ритму';
  if (/ambient|lo-?fi/.test(genre)) return 'эмбиент тянет к минимализму и пустоте';
  if (/pop|hip-?hop|rap|rock|indie/.test(genre)) return 'энергичный жанр тянет к коллажу';
  return 'нейтрально';
}

function seasonRu(season: string): string {
  return ({ autumn: 'осень, охра', winter: 'зима, сине-серый', spring: 'весна, розоватый', summer: 'лето, солнечный жёлтый' } as Record<string, string>)[season] ?? season;
}
