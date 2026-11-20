import { describe, expect, it } from 'vitest';
import { commonShotDate, exifDateTime, exifToIso, shotHour } from './exif';

/** Минимальный JPEG: SOI, APP1 с TIFF (IFD0 → Exif IFD → DateTimeOriginal), SOS. */
function jpegWithExif(date: string, le: boolean, viaIfd0 = false): ArrayBuffer {
  const tiff: number[] = [];
  const u16 = (n: number) => (le ? [n & 255, n >> 8] : [n >> 8, n & 255]);
  const u32 = (n: number) => (le ? [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24] : [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255]);
  const str = [...date].map((c) => c.charCodeAt(0)).concat(0); // 20 байт
  tiff.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8));
  if (viaIfd0) {
    // IFD0 @8: 1 запись DateTime → строка @26
    tiff.push(...u16(1), ...u16(0x0132), ...u16(2), ...u32(str.length), ...u32(26), ...u32(0), ...str);
  } else {
    // IFD0 @8: 1 запись ExifIFD → @26; Exif IFD @26: DateTimeOriginal → строка @44
    tiff.push(...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0));
    tiff.push(...u16(1), ...u16(0x9003), ...u16(2), ...u32(str.length), ...u32(44), ...u32(0), ...str);
  }
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = app1.length + 2;
  const bytes = [0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...app1, 0xff, 0xda, 0, 2];
  return new Uint8Array(bytes).buffer;
}

describe('EXIF (план 20.11, A2)', () => {
  it('читает DateTimeOriginal в little-endian (Android) и big-endian (iPhone)', () => {
    expect(exifDateTime(jpegWithExif('2026:10:18 19:40:12', true))).toBe('2026-10-18T19:40');
    expect(exifDateTime(jpegWithExif('2026:10:18 08:05:00', false))).toBe('2026-10-18T08:05');
  });
  it('без Exif IFD берёт DateTime из IFD0', () => {
    expect(exifDateTime(jpegWithExif('2025:01:02 23:59:00', true, true))).toBe('2025-01-02T23:59');
  });
  it('JPEG без EXIF, не JPEG и пустая дата → null', () => {
    expect(exifDateTime(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer)).toBeNull();
    expect(exifDateTime(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBeNull();
    expect(exifDateTime(jpegWithExif('0000:00:00 00:00:00', true))).toBeNull();
    expect(exifToIso('мусор')).toBeNull();
  });
  it('общая дата съёмки — только если у всех фото один день', () => {
    expect(commonShotDate(['2026-10-18T19:40', '2026-10-18T20:10'])).toBe('2026-10-18');
    expect(commonShotDate(['2026-10-18T19:40', '2026-10-19T09:00'])).toBeNull();
    expect(commonShotDate(['2026-10-18T19:40', null])).toBeNull();
    expect(commonShotDate([])).toBeNull();
  });
  it('час съёмки — медиана фото этой даты', () => {
    expect(shotHour(['2026-10-18T19:40', '2026-10-18T21:00', '2026-10-18T08:00'], '2026-10-18')).toBe(19);
    expect(shotHour(['2026-10-17T19:40'], '2026-10-18')).toBeUndefined();
  });
});
