// Фильмы по темам: дневник сам находит общие темы дней (сезон, ночи, вода, друзья, одна песня, настроение)
// и собирает из всех их фото одно видео. Тема — это правило, а не случайная подборка: у каждой есть «почему».
import { songKey } from './music/songKey';
import type { DayRecord } from './types';

export interface Theme {
  id: string;
  title: string;
  why: string;          // по какому правилу дни попали в тему
  days: DayRecord[];    // от первого к последнему
  photoCount: number;
  colors: string[];     // акценты дней — для титров и обложки фильма
}

interface Rule { id: string; title: string; why: string; match: (d: DayRecord) => boolean }

const mood = (d: DayRecord) => d.analysis?.mood;

const RULES: Rule[] = [
  { id: 'autumn', title: 'Осень', why: 'дни, записанные осенью', match: (d) => d.analysis?.season === 'autumn' },
  { id: 'winter', title: 'Зима', why: 'дни, записанные зимой', match: (d) => d.analysis?.season === 'winter' },
  { id: 'spring', title: 'Весна', why: 'дни, записанные весной', match: (d) => d.analysis?.season === 'spring' },
  { id: 'summer', title: 'Лето', why: 'дни, записанные летом', match: (d) => d.analysis?.season === 'summer' },
  { id: 'nights', title: 'Ночи', why: 'всё, что случилось ночью', match: (d) => d.analysis?.timeOfDay === 'night' },
  { id: 'evenings', title: 'Вечера', why: 'дни, которые запомнились вечером', match: (d) => d.analysis?.timeOfDay === 'evening' },
  { id: 'water', title: 'У воды', why: 'море, озеро, река, пруд', match: (d) => d.analysis?.setting === 'water' },
  { id: 'nature', title: 'На природе', why: 'парки, лес, горы', match: (d) => d.analysis?.setting === 'nature' },
  { id: 'city', title: 'Город', why: 'улицы и огни города', match: (d) => d.analysis?.setting === 'city' },
  { id: 'road', title: 'В дороге', why: 'поезда, самолёты, машины', match: (d) => d.analysis?.setting === 'transport' },
  { id: 'friends', title: 'С друзьями', why: 'дни, где рядом была компания', match: (d) => d.analysis?.people === 'group' },
  { id: 'two', title: 'Вдвоём', why: 'дни на двоих', match: (d) => d.analysis?.people === 'pair' },
  { id: 'alone', title: 'Наедине с собой', why: 'тихие дни в одиночестве', match: (d) => d.analysis?.people === 'alone' },
  { id: 'bright', title: 'Светлые дни', why: 'самые радостные записи', match: (d) => (mood(d)?.valence ?? 0) > 0.4 },
  { id: 'quiet', title: 'Тихая грусть', why: 'дни, когда было грустно', match: (d) => (mood(d)?.valence ?? 0) < -0.2 },
  { id: 'nerves', title: 'На нервах', why: 'дедлайны и напряжение', match: (d) => (mood(d)?.tension ?? 0) > 0.6 },
  { id: 'memories', title: 'Воспоминания', why: 'дни про детство, близких и прошлое', match: (d) => (mood(d)?.nostalgia ?? 0) > 0.5 },
];

const chrono = (a: DayRecord, b: DayRecord) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date < b.date ? -1 : 1);

function theme(id: string, title: string, why: string, days: DayRecord[]): Theme {
  const sorted = [...days].sort(chrono);
  return {
    id, title, why, days: sorted,
    photoCount: sorted.reduce((n, d) => n + d.photos.length, 0),
    colors: sorted.map((d) => d.style?.palette.accents[0]).filter((c): c is string => !!c),
  };
}

/** Темы дневника, где хотя бы два дня с фото. Крупные темы — первыми. */
export function findThemes(days: DayRecord[], minDays = 2): Theme[] {
  const usable = days.filter((d) => d.status === 'ready' && d.photos.length > 0 && !d.sealed);
  const out: Theme[] = [];
  for (const r of RULES) {
    const list = usable.filter(r.match);
    if (list.length >= minDays) out.push(theme(r.id, r.title, r.why, list));
  }
  // Под одну песню: самая сильная связь — одни и те же дни под один трек.
  const bySong = new Map<string, DayRecord[]>();
  for (const d of usable) {
    const k = songKey(d.song);
    if (k) bySong.set(k, [...(bySong.get(k) ?? []), d]);
  }
  for (const [k, list] of bySong) {
    if (list.length < minDays) continue;
    const s = list[0].song;
    const name = [s.artist, s.title].filter(Boolean).join(' — ') || 'одна песня';
    out.push(theme(`song:${k}`, `Под одну песню`, `все дни с песней «${name}»`, list));
  }
  if (usable.length >= minDays) out.push(theme('all', 'Весь дневник', 'все дни подряд', usable));
  return out.sort((a, b) => (a.id === 'all' ? 1 : b.id === 'all' ? -1 : b.days.length - a.days.length || b.photoCount - a.photoCount));
}

// ── Монтаж: сколько длится каждый кусок фильма ──
export interface Shot { day: number; photo: number; start: number; end: number }
export const TITLE_SEC = 2.6, END_SEC = 2.4, FADE_SEC = 0.7, MAX_PHOTOS = 24;

/** Раскладка фильма: титр, по кадру на фото (ритм от BPM первого дня), финал. Не длиннее ~60 с. */
export function montagePlan(t: Pick<Theme, 'days'>): { shots: Shot[]; duration: number } {
  const photos: { day: number; photo: number }[] = [];
  t.days.forEach((d, di) => d.photos.forEach((_, pi) => photos.push({ day: di, photo: pi })));
  // Слишком много фото — берём равномерно, чтобы были все дни, а фильм не затянулся.
  const pick = photos.length > MAX_PHOTOS ? Array.from({ length: MAX_PHOTOS }, (_, i) => photos[Math.floor((i * photos.length) / MAX_PHOTOS)]) : photos;
  const bpm = t.days[0]?.style?.motion.bpm ?? 90;
  const shotSec = Math.min(3.2, Math.max(1.6, (4 * 60) / bpm));   // кадр = 4 доли песни
  let at = TITLE_SEC;
  const shots = pick.map((p) => { const s = { ...p, start: at, end: at + shotSec }; at += shotSec; return s; });
  return { shots, duration: at + END_SEC };
}
