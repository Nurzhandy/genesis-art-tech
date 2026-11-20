// Zod-схемы входа API (A2).
import { z } from 'zod';

export const SongProviderSchema = z.enum(['spotify', 'youtube', 'yandex', 'apple', 'deezer', 'soundcloud', 'other']);

export const SongInput = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('link'),
    url: z.url(),
    provider: SongProviderSchema,
    title: z.string().max(200).optional(),
    artist: z.string().max(200).optional(),
    embedUrl: z.url().optional(),
    previewUrl: z.string().max(500).optional(),
    coverUrl: z.url().optional(),
    year: z.number().int().min(1900).max(2100).optional(),
  }),
  z.object({
    kind: z.literal('file'),
    path: z.string().optional(),          // назначает сервер при создании дня
    ext: z.enum(['mp3', 'm4a', 'wav', 'ogg']).optional(),
    title: z.string().max(200).optional(),
    artist: z.string().max(200).optional(),
  }),
]);

export const NewDayInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  text: z.string().trim().min(1).max(5000),
  photoCount: z.number().int().min(1).max(5),
  song: SongInput,
  place: z.string().trim().max(80).optional(),                          // город для погоды (план 20.11, A1)
  sealedUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),     // капсула времени (A5)
});
export type NewDayInput = z.infer<typeof NewDayInput>;

const PHOTO_EXT = ['jpg', 'jpeg', 'png', 'webp'] as const;
const AUDIO_EXT = ['mp3', 'm4a', 'wav', 'ogg'] as const;

export const UploadFile = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('photo'), index: z.number().int().min(0).max(4), ext: z.enum(PHOTO_EXT) }),
  z.object({ kind: z.literal('thumb'), index: z.number().int().min(0).max(4), ext: z.enum(['jpg', 'jpeg']) }),
  z.object({ kind: z.literal('audio'), ext: z.enum(AUDIO_EXT) }),
  z.object({ kind: z.literal('poster'), ext: z.literal('jpg') }),
]);
export const UploadRequest = z.object({ files: z.array(UploadFile).min(1).max(12) });
export type UploadFile = z.infer<typeof UploadFile>;

const unit = z.number().min(0).max(1);
const HEX = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const PhotoFeaturesSchema = z.object({
  index: z.number().int().min(0).max(4),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(1).max(8),
  brightness: unit,
  warmth: z.number().min(-1).max(1),
  saturation: unit,
});

export const MusicFeaturesSchema = z.object({
  source: z.enum(['audio', 'deezer', 'llm']),
  bpm: z.number().min(0).max(250),          // 0 у Deezer = «нет данных», mergeMusic это учитывает
  energy: unit,
  mode: z.enum(['major', 'minor', 'unknown']),
  brightness: unit.optional(),
  genre: z.string().max(60).optional(),
  year: z.number().int().optional(),
  coverPalette: z.array(HEX).max(5).optional(),
});

export const GenerateBody = z.object({
  photoFeatures: z.array(PhotoFeaturesSchema).min(1).max(5),
  music: MusicFeaturesSchema.nullable(),
  coverPalette: z.array(HEX).max(5).optional(),        // цвета обложки альбома (план 20.11, A3)
  photoHour: z.number().int().min(0).max(23).optional(), // час съёмки из EXIF (A2)
});
export type GenerateBody = z.infer<typeof GenerateBody>;
