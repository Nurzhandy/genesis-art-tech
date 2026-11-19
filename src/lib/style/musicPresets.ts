// Наборы музыки для режима «Те же фото, другая песня» в /lab (ресерч R5).
import type { MusicFeatures } from '@/lib/types';

export const MUSIC_PRESETS: { id: string; label: string; music: MusicFeatures }[] = [
  { id: 'sinatra', label: 'Frank Sinatra · 76 BPM · мажор · 1957', music: { source: 'llm', bpm: 76, energy: 0.3, mode: 'major', genre: 'jazz', year: 1957 } },
  { id: 'techno', label: 'Техно · 128 BPM · минор', music: { source: 'llm', bpm: 128, energy: 0.92, mode: 'minor', genre: 'techno', year: 2021 } },
  { id: 'ambient', label: 'Эмбиент · 70 BPM · минор', music: { source: 'llm', bpm: 70, energy: 0.18, mode: 'minor', genre: 'ambient', year: 2015 } },
  { id: 'pop', label: 'Поп · 118 BPM · мажор', music: { source: 'llm', bpm: 118, energy: 0.78, mode: 'major', genre: 'pop', year: 2023 } },
];
