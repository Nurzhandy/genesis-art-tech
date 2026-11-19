'use client';
// «Скачать папку»: ZIP со всем, что относится к дню (A8).
import type { DayRecord } from '@/lib/types';

export interface FolderFile { name: string; url?: string; text?: string; kind: 'text' | 'photo' | 'audio' | 'image' | 'data' }

export function folderFiles(day: DayRecord): FolderFile[] {
  const files: FolderFile[] = [
    { name: 'text.md', kind: 'text', text: `# ${day.title}\n\n${day.date}\n\n${day.text}\n` },
    ...day.photos.map((p, i) => ({ name: `photos/${String(i + 1).padStart(2, '0')}.jpg`, kind: 'photo' as const, url: p.url })),
  ];
  if (day.song.kind === 'file' && day.song.path) files.push({ name: `song.${day.song.path.split('.').pop()}`, kind: 'audio', url: day.songUrl });
  files.push({ name: 'song.json', kind: 'data', text: JSON.stringify(day.song, null, 2) });
  if (day.posterUrl) files.push({ name: 'memory.png', kind: 'image', url: day.posterUrl });
  if (day.voice?.url) files.push({ name: 'voice.mp3', kind: 'audio', url: day.voice.url });
  if (day.analysis) files.push({ name: 'analysis.json', kind: 'data', text: JSON.stringify(day.analysis, null, 2) });
  if (day.style) files.push({ name: 'style.json', kind: 'data', text: JSON.stringify(day.style, null, 2) });
  return files;
}

export async function downloadDayZip(day: DayRecord): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const folder = zip.folder(`${day.date} ${day.title}`)!;
  await Promise.all(folderFiles(day).map(async (f) => {
    if (f.text !== undefined) folder.file(f.name, f.text);
    else if (f.url) {
      const res = await fetch(f.url);
      if (res.ok) folder.file(f.name, await res.blob());
    }
  }));
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${day.date} ${day.title}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
