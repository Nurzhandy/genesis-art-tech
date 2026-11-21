import Link from 'next/link';
import { ThoughtsVault } from '@/components/ThoughtsVault';

export const metadata = { title: 'Мысли — Дневник атмосферы' };

export default function ThoughtsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
      <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-muted hover:text-foreground">← дневник атмосферы</Link>
      <h1 className="mb-2 mt-4 text-5xl font-semibold leading-tight">Мысли</h1>
      <p className="mb-8 max-w-xl text-xl leading-relaxed text-muted">
        Место для всего, что не дотягивает до целого дня: мысль, цитата, ссылка, идея. Бросьте сюда — потом найдёте.
      </p>
      <ThoughtsVault />
    </main>
  );
}
