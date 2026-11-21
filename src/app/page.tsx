import Link from 'next/link';
import { CursorLight } from '@/components/fx/CursorLight';
import { PageFade } from '@/components/fx/PageFade';
import { DiaryStrip } from '@/components/home/DiaryStrip';
import { KineticTitle } from '@/components/home/KineticTitle';
import { MemoryMachine } from '@/components/home/MemoryMachine';
import { MoodMarquee } from '@/components/home/MoodMarquee';
import { Desk } from '@/components/shelf/Desk';
import { FeatureBento } from '@/components/home/FeatureBento';
import { HeroAurora } from '@/components/home/HeroAurora';
import { TellTodayButton } from '@/components/home/TellTodayButton';
import { EntryIntro } from '@/components/fx/EntryIntro';

const STEPS = [
  { n: '01', title: 'Расскажите о дне', text: 'Как другу: погода, свет, запахи, кто был рядом. Приложите 1–5 фото и песню — ссылкой или файлом.' },
  { n: '02', title: 'Система читает день', text: 'Цвета и свет фото, темп и лад песни, погода того дня, настроение записи. Каждое решение записывается с причиной.' },
  { n: '03', title: 'День становится страницей', text: 'Мазки Моне, геометрия Кандинского, плёнка, коллаж или пустота — по правилам. Под песню, в папке со своим названием.' },
];

export default function Home() {
  return (
    <PageFade>
      <main className="flex flex-1 flex-col">
        <EntryIntro />
        <HeroAurora>
          <section id="tell" className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:pt-20 lg:grid-cols-[1fr_minmax(0,520px)]">
            <div className="flex flex-col items-start gap-7">
              <KineticTitle lines={['Сохраните,', 'как ощущался день']} className="text-5xl font-semibold leading-[0.95] sm:text-7xl" />
              <p className="hero-rise max-w-lg text-xl leading-relaxed" style={{ animationDelay: '0.9s' }}>
                Расскажите о дне голосом или текстом, добавьте фото и песню — и он станет живой страницей
                в цветах, погоде и ритме того дня. Через год откроете — и снова почувствуете.
              </p>
              <div className="hero-rise" style={{ animationDelay: '1.2s' }}><TellTodayButton /></div>
              <div className="hero-rise flex flex-wrap items-center gap-x-6 gap-y-2 text-lg" style={{ animationDelay: '1.45s' }}>
                <Link href="/diary/demo" className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground">Полистать демо-дневник</Link>
                <Link href="/thoughts" className="text-muted underline-offset-4 hover:text-foreground hover:underline">Мысли</Link>
                <a href="#features" className="text-muted underline-offset-4 hover:text-foreground hover:underline">Что ещё умеет</a>
              </div>
            </div>
            <div className="hero-card flex justify-center" style={{ animationDelay: '0.6s' }}>
              <MemoryMachine />
            </div>
          </section>
        </HeroAurora>

        <FeatureBento />

        <CursorLight className="overflow-hidden">
          <section className="mx-auto w-full max-w-6xl px-4 pt-10">
            <h2 className="reveal text-5xl font-semibold leading-tight">Ваш стол</h2>
            <p className="reveal mt-2 max-w-xl text-xl leading-relaxed text-muted">Заводите дневники для разных сфер жизни: воспоминания, поездки, работа, люди.</p>
          </section>
          <Desk />
        </CursorLight>

        <MoodMarquee />

        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="reveal border-t border-foreground/15 pt-5">
              <p className="font-mono text-xs text-muted">{s.n}</p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight">{s.title}</h2>
              <p className="mt-3 text-lg leading-relaxed text-muted">{s.text}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-20">
          <div className="reveal mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">проверка лентой</p>
              <h2 className="text-5xl font-semibold leading-tight">Один дневник — разные дни</h2>
            </div>
            <Link href="/lab" className="font-mono text-xs uppercase tracking-[0.2em] text-muted underline-offset-4 hover:text-foreground hover:underline">лаборатория стиля →</Link>
          </div>
          <DiaryStrip />
        </section>

        <section className="reveal mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 pb-24 text-center">
          <p className="font-hand text-4xl">Каким был ваш день?</p>
          <TellTodayButton />
        </section>
      </main>
    </PageFade>
  );
}
