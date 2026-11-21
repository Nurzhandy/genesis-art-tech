import Link from 'next/link';
import { VideoMaker } from '@/components/VideoMaker';

export const metadata = { title: 'Видео из фото — Дневник атмосферы' };

export default function VideoPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
      <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-muted hover:text-foreground">← дневник атмосферы</Link>
      <h1 className="mb-2 mt-4 text-5xl font-semibold leading-tight">Видео из фото</h1>
      <p className="mb-8 max-w-2xl text-xl leading-relaxed text-muted">
        Добавьте фото — дневник поймёт их настроение по цветам и свету, подберёт песню и склеит видео
        с переходами под её ритм. Готово для сторис и чтобы отправить близким.
      </p>
      <VideoMaker />
    </main>
  );
}
