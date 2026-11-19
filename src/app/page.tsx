import Link from 'next/link';
import { OpenDiaryButton } from '@/components/OpenDiaryButton';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-20 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">Make the Invisible Visible</p>
      <h1 className="text-6xl font-semibold leading-[0.95] sm:text-7xl">Дневник<br />атмосферы</h1>
      <p className="max-w-lg text-xl leading-relaxed text-muted">
        Фото помнят, как выглядел день. Этот дневник помнит, как он ощущался: расскажите о дне,
        приложите фото и песню — и они станут живой страницей в цветах и ритме того дня.
      </p>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <OpenDiaryButton />
        <Link href="/diary/demo" className="rounded-full border border-foreground/30 px-8 py-3.5 font-mono text-sm uppercase tracking-[0.15em] transition hover:bg-foreground hover:text-background">
          Демо-дневник
        </Link>
      </div>
      <p className="font-hand text-2xl -rotate-2 text-muted">откройте запись через год — и снова почувствуйте тот день</p>
      <Link href="/lab" className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted underline-offset-4 hover:underline">лаборатория стиля →</Link>
    </main>
  );
}
