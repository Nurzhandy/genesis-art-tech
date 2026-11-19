import type { StyleParams } from '@/lib/types';
import type { PhotoTime } from './timeline';

export interface Zone { x: number; y: number; w: number; h: number }
export interface RenderPhoto { img: CanvasImageSource; w: number; h: number }
export interface Fonts { serif: string; mono: string; hand: string }

export interface DayInfo {
  title: string;
  caption: string;
  date: string;           // yyyy-mm-dd
  dayNumber?: number;
  songLabel?: string;
  notes?: string[];       // детали из записи для заметок на полях (ресерч R2)
}

export interface RenderCtx {
  ctx: CanvasRenderingContext2D;
  W: number; H: number;
  style: StyleParams;
  photos: RenderPhoto[];
  zone: Zone;
  fonts: Fonts;
  /** 0..1: громкость живого звука или пульс по BPM */
  energy: (pt: PhotoTime) => number;
}

export interface TechniqueRenderer {
  prepare(rc: RenderCtx): void;
  drawPhoto(rc: RenderCtx, pt: PhotoTime, opts: { realtime: boolean }): void;
  drawOverlay(rc: RenderCtx, pt: PhotoTime, alpha: number): void;
}
