// Лендинг (план 21.11, C1): показ продукта для гостя. Стол с дневниками живёт на /home (часть B),
// вошедший человек уходит туда сразу. Здесь ничего нельзя сломать: только демо и путь к регистрации.
import Link from 'next/link';
import { CursorLight } from '@/components/fx/CursorLight';
import { PageFade } from '@/components/fx/PageFade';
import { EntryIntro } from '@/components/fx/EntryIntro';
import { DiaryStrip } from '@/components/home/DiaryStrip';
import { KineticTitle } from '@/components/home/KineticTitle';
import { LandingNav, LandingRedirect } from '@/components/home/LandingAuth';
import { MemoryMachine } from '@/components/home/MemoryMachine';
import { MoodMarquee } from '@/components/home/MoodMarquee';
// Адреса из контракта auth (часть A). Константы из 'use client'-файла в серверный компонент не попадают.
const SIGNUP = '/signup';

const STEPS = [
  { n: '01', title: 'Положите день на доску', text: 'Заметки, фото, песня, голосовое, капля настроения, рисунок и стикеры — в любом порядке. Ничего не обязательно: хватит и одной строчки.' },
  { n: '02', title: 'Система читает день', text: 'Цвета и свет фото, темп песни, погода того дня, ваши слова и чувство. Каждое решение записывается с причиной.' },
  { n: '03', title: 'Нажмите «Собрать день»', text: 'Всё слетается в живую страницу под вашу песню: мазки Моне, геометрия Кандинского, плёнка или коллаж. Её можно украсить, пересобрать и подарить.' },
];

const ON_BOARD = ['✎ заметки', '▣ фото', '◉ песня', '🎙 голосовое', '● настроение', '〰 рисунок', '✦ стикеры'];

const primaryBtn = 'rounded-full bg-foreground px-8 py-3.5 text-center font-mono text-sm uppercase tracking-[0.15em] text-background transition hover:opacity-90';
const ghostBtn = 'rounded-full border border-foreground/30 px-8 py-3.5 text-center font-mono text-sm uppercase tracking-[0.15em] transition-colors hover:bg-foreground hover:text-background';

export default function Landing() {
  return (
    <PageFade>
      <LandingRedirect />
      <main className="flex flex-1 flex-col overflow-x-clip">
        <EntryIntro />
        <header className="sticky top-0 z-30 border-b border-foreground/5 bg-background/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="font-hand text-2xl leading-none sm:text-3xl">Дневник атмосферы</Link>
            <LandingNav />
          </div>
        </header>

        <CursorLight className="overflow-hidden">
          <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:pt-20 xl:grid-cols-[1fr_minmax(0,560px)]">
            <div className="flex flex-col items-start gap-6">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted" style={{ animation: 'pop-in 0.6s ease-out both' }}>Make the Invisible Visible</p>
              <KineticTitle lines={['Сохраните,', 'как ощущался день']} className="text-5xl font-semibold leading-[0.95] sm:text-7xl" />
              <p className="max-w-md text-xl leading-relaxed text-muted" style={{ animation: 'pop-in 0.8s ease-out 0.8s both' }}>
                День — запись, фото, песня и голос — становится живой страницей в цветах, погоде и ритме того дня.
              </p>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row" style={{ animation: 'pop-in 0.8s ease-out 1s both' }}>
                <Link href={SIGNUP} data-magnetic className={primaryBtn}>Начать</Link>
                <Link href="/diary/demo" className={ghostBtn}>Смотреть демо</Link>
              </div>
            </div>
            <div className="flex justify-center">
              <MemoryMachine />
            </div>
          </section>
        </CursorLight>

        <MoodMarquee />

        <section className="mx-auto w-full max-w-6xl px-4 py-20">
          <div className="reveal mb-10 flex flex-col gap-4">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">как это работает</p>
            <h2 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">Фото помнят, как выглядел день. Дневник помнит, как он ощущался.</h2>
            <ul className="flex flex-wrap gap-2" aria-label="Что можно положить на доску дня">
              {ON_BOARD.map((x) => <li key={x} className="rounded-full bg-foreground/5 px-3 py-1.5 font-mono text-xs">{x}</li>)}
            </ul>
          </div>
          <div className="grid gap-10 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="reveal border-t border-foreground/15 pt-5">
                <p className="font-mono text-xs text-muted">{s.n}</p>
                <h3 className="mt-2 text-3xl font-semibold leading-tight">{s.title}</h3>
                <p className="mt-3 text-lg leading-relaxed text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-20">
          <div className="reveal mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">примеры</p>
              <h2 className="text-4xl font-semibold leading-tight sm:text-5xl">Один дневник — разные дни</h2>
            </div>
            <Link href="/diary/demo" className="font-mono text-xs uppercase tracking-[0.2em] text-muted underline-offset-4 hover:text-foreground hover:underline">весь демо-дневник →</Link>
          </div>
          <DiaryStrip />
        </section>

        <section className="reveal mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 pb-24 text-center">
          <p className="font-hand text-4xl sm:text-5xl">Каким был ваш день?</p>
          <p className="max-w-md text-lg text-muted">Заведите дневник за минуту — он будет с вами на любом устройстве.</p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href={SIGNUP} data-magnetic className={primaryBtn}>Начать бесплатно</Link>
            <Link href="/diary/demo" className={ghostBtn}>Смотреть демо</Link>
          </div>
        </section>
      </main>
    </PageFade>
  );
}
