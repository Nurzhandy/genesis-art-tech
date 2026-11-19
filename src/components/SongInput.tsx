'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client/api';
import { analyzeAudioFile } from '@/lib/client/audioAnalysis';
import type { MusicFeatures, SongRef } from '@/lib/types';

export type SongState =
  | { kind: 'none' }
  | { kind: 'link'; url: string; status: 'checking' | 'ok' | 'error'; song?: SongRef; music: MusicFeatures | null; error?: string }
  | { kind: 'file'; file: File; ext: string; title: string; status: 'checking' | 'ok' | 'error'; music: MusicFeatures | null };

export function SongInput({ value, onChange }: { value: SongState; onChange: (s: SongState) => void }) {
  const [tab, setTab] = useState<'link' | 'file'>(value.kind === 'file' ? 'file' : 'link');
  const [url, setUrl] = useState(value.kind === 'link' ? value.url : '');
  const fileRef = useRef<HTMLInputElement>(null);
  const latest = useRef(onChange);
  useEffect(() => { latest.current = onChange; }, [onChange]);

  useEffect(() => {
    if (tab !== 'link') return;
    const u = url.trim();
    if (!u) { latest.current({ kind: 'none' }); return; }
    latest.current({ kind: 'link', url: u, status: 'checking', music: null });
    const t = setTimeout(async () => {
      try {
        const r = await api.resolveSong(u);
        latest.current({ kind: 'link', url: u, status: 'ok', song: r.song, music: r.music });
      } catch (e) {
        latest.current({ kind: 'link', url: u, status: 'error', music: null, error: e instanceof Error ? e.message : 'Не получилось распознать ссылку' });
      }
    }, 500);
    return () => clearTimeout(t);
  }, [url, tab]);

  async function pickFile(f: File | undefined) {
    if (!f) return;
    const ext = (f.name.split('.').pop() ?? '').toLowerCase();
    if (!['mp3', 'm4a', 'wav', 'ogg'].includes(ext)) {
      onChange({ kind: 'file', file: f, ext, title: f.name, status: 'error', music: null });
      return;
    }
    const title = f.name.replace(/\.[^.]+$/, '');
    onChange({ kind: 'file', file: f, ext, title, status: 'checking', music: null });
    try {
      onChange({ kind: 'file', file: f, ext, title, status: 'ok', music: await analyzeAudioFile(f) });
    } catch {
      onChange({ kind: 'file', file: f, ext, title, status: 'ok', music: null });
    }
  }

  const song = value.kind === 'link' ? value.song : undefined;
  const label = song?.kind === 'link' && (song.artist || song.title) ? [song.artist, song.title].filter(Boolean).join(' — ') : null;

  return (
    <div>
      <div className="mb-3 inline-flex rounded-full border border-foreground/20 p-0.5 font-mono text-xs">
        {(['link', 'file'] as const).map((t) => (
          <button key={t} type="button" onClick={() => { setTab(t); onChange({ kind: 'none' }); }}
            className={`rounded-full px-3 py-1 transition ${tab === t ? 'bg-foreground text-background' : 'text-muted hover:text-foreground'}`}>
            {t === 'link' ? 'ссылка' : 'файл'}
          </button>
        ))}
      </div>
      {tab === 'link' ? (
        <div>
          <input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="Ссылка на Spotify, YouTube, Яндекс Музыку, Deezer…"
            className="w-full border-b border-foreground/30 bg-transparent py-2 font-mono text-sm outline-none placeholder:text-muted/70 focus:border-foreground" />
          <p className="mt-2 min-h-5 text-sm">
            {value.kind === 'link' && value.status === 'checking' && <span className="text-muted">слушаю ссылку…</span>}
            {value.kind === 'link' && value.status === 'ok' && (
              <span>{label ?? 'Ссылка принята'} <span className="text-green-700 dark:text-green-400">✓</span>
                {value.music?.bpm ? <span className="ml-2 font-mono text-xs text-muted">{Math.round(value.music.bpm)} BPM</span> : null}</span>
            )}
            {value.kind === 'link' && value.status === 'error' && <span className="text-red-700 dark:text-red-400">{value.error}</span>}
          </p>
        </div>
      ) : (
        <div>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="rounded-sm border border-dashed border-foreground/30 px-4 py-3 text-sm text-muted transition hover:border-foreground/60 hover:text-foreground">
            {value.kind === 'file' ? value.file.name : 'Выбрать аудиофайл (mp3, m4a, wav, ogg)'}
          </button>
          <input ref={fileRef} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
          <p className="mt-2 min-h-5 text-sm">
            {value.kind === 'file' && value.status === 'checking' && <span className="text-muted">слушаю трек: темп и энергия…</span>}
            {value.kind === 'file' && value.status === 'ok' && value.music && (
              <span className="font-mono text-xs text-muted">{value.music.bpm} BPM · энергия {Math.round(value.music.energy * 100)}%</span>
            )}
            {value.kind === 'file' && value.status === 'error' && <span className="text-red-700 dark:text-red-400">Подойдут mp3, m4a, wav или ogg</span>}
          </p>
          <p className="text-xs text-muted">Файл виден только вам и хранится в закрытой папке дня.</p>
        </div>
      )}
    </div>
  );
}
