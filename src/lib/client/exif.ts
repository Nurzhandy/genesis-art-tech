// Дата и время съёмки из EXIF JPEG (план 20.11, A2) — маленький парсер APP1 без библиотек.
// Читаем DateTimeOriginal (0x9003) из Exif IFD, иначе DateTime (0x0132) из IFD0.

const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME = 0x0132;

/** «2026:10:18 19:40:12» → «2026-10-18T19:40». Нули и мусор → null. */
export function exifToIso(s: string): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/.exec(s.trim());
  if (!m || m[1] === '0000') return null;
  const [, y, mo, d, h, mi] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31 || +h > 23 || +mi > 59) return null;
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

function readIfd(v: DataView, tiff: number, ifd: number, le: boolean): Map<number, { type: number; count: number; at: number }> {
  const out = new Map<number, { type: number; count: number; at: number }>();
  if (tiff + ifd + 2 > v.byteLength) return out;
  const n = v.getUint16(tiff + ifd, le);
  for (let i = 0; i < n; i++) {
    const e = tiff + ifd + 2 + i * 12;
    if (e + 12 > v.byteLength) break;
    out.set(v.getUint16(e, le), { type: v.getUint16(e + 2, le), count: v.getUint32(e + 4, le), at: e + 8 });
  }
  return out;
}

function ascii(v: DataView, tiff: number, entry: { type: number; count: number; at: number }, le: boolean): string | null {
  if (entry.type !== 2) return null;
  const start = entry.count > 4 ? tiff + v.getUint32(entry.at, le) : entry.at;
  if (start + entry.count > v.byteLength) return null;
  let s = '';
  for (let i = 0; i < entry.count; i++) {
    const c = v.getUint8(start + i);
    if (!c) break;
    s += String.fromCharCode(c);
  }
  return s;
}

/** Время съёмки JPEG или null (не JPEG, нет EXIF, нет даты). */
export function exifDateTime(buf: ArrayBuffer): string | null {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
  let p = 2;
  while (p + 4 <= v.byteLength) {
    const marker = v.getUint16(p);
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null;   // дошли до картинки — EXIF нет
    const len = v.getUint16(p + 2);
    if (marker === 0xffe1 && p + 10 <= v.byteLength && v.getUint32(p + 4) === 0x45786966 /* Exif */) {
      const tiff = p + 10;
      if (tiff + 8 > v.byteLength) return null;
      const le = v.getUint16(tiff) === 0x4949;
      const ifd0 = readIfd(v, tiff, v.getUint32(tiff + 4, le), le);
      const exifPtr = ifd0.get(TAG_EXIF_IFD);
      if (exifPtr) {
        const exif = readIfd(v, tiff, v.getUint32(exifPtr.at, le), le);
        const orig = exif.get(TAG_DATETIME_ORIGINAL);
        const iso = orig && exifToIso(ascii(v, tiff, orig, le) ?? '');
        if (iso) return iso;
      }
      const dt = ifd0.get(TAG_DATETIME);
      return dt ? exifToIso(ascii(v, tiff, dt, le) ?? '') : null;
    }
    p += 2 + len;
  }
  return null;
}

/** Подсказка формы: если все фото сняты в один день — этот день. */
export function commonShotDate(takenAt: (string | null | undefined)[]): string | null {
  const dates = takenAt.map((t) => t?.slice(0, 10));
  if (!dates.length || dates.some((d) => !d)) return null;
  return dates.every((d) => d === dates[0]) ? dates[0]! : null;
}

/** Час съёмки для анализа: медиана часов фото, снятых в дату записи. */
export function shotHour(takenAt: (string | null | undefined)[], date: string): number | undefined {
  const hours = takenAt.filter((t): t is string => !!t && t.startsWith(date)).map((t) => Number(t.slice(11, 13))).sort((a, b) => a - b);
  return hours.length ? hours[Math.floor((hours.length - 1) / 2)] : undefined;
}
