import Link from 'next/link';
import { CursorLight } from '@/components/fx/CursorLight';
import { PageFade } from '@/components/fx/PageFade';
import { DiaryStrip } from '@/components/home/DiaryStrip';
import { KineticTitle } from '@/components/home/KineticTitle';
import { MemoryMachine } from '@/components/home/MemoryMachine';
import { MoodMarquee } from '@/components/home/MoodMarquee';
import { OpenDiaryButton } from '@/components/OpenDiaryButton';

const STEPS = [
  { n: '01', title: 'Расскажите о дне', text: 'Как другу: погода, свет, запахи, кто был рядом. Приложите 1–5 фото и песню — ссылкой или файлом.' },
  { n: '02', title: 'Система читает день', text: 'Цвета и свет фото, темп и лад песни, погода того дня, настроение записи. Каждое решение записывается с причиной.' },
  { n: '03', title: 'День становится страницей', text: 'Мазки Моне, геометрия Кандинского, плёнка, коллаж или пустота — по правилам. Под песню, в папке со своим названием.' },
];

export default function Home() {
  return (
    <PageFade>
      <main className="flex flex-1 flex-col">
        <CursorLight className="overflow-hidden">
          <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-10 pt-14 sm:pt-20 xl:grid-cols-[1fr_minmax(0,600px)]">
            <div className="flex flex-col items-start gap-7">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted" style={{ animation: 'pop-in 0.6s ease-out both' }}>Make the Invisible Visible</p>
              <KineticTitle lines={['Дневник', 'атмосферы']} className="text-6xl font-semibold leading-[0.95] sm:text-8xl xl:text-[7.5rem]" />
              <p className="max-w-md text-xl leading-relaxed text-muted" style={{ animation: 'pop-in 0.8s ease-out 0.9s both' }}>
                Фото помнят, как выглядел день. Этот дневник помнит, как он ощущался: запись, фото и песня
                становятся живой страницей в цветах, погоде и ритме того дня.
              </p>
              <div className="flex flex-wrap items-center gap-4" style={{ animation: 'pop-in 0.8s ease-out 1.1s both' }}>
                <OpenDiaryButton />
                <Link href="/diary/demo" data-magnetic className="rounded-full border border-foreground/30 px-8 py-3.5 font-mono text-sm uppercase tracking-[0.15em] transition-colors hover:bg-foreground hover:text-background">
                  Демо-дневник
                </Link>
              </div>
              <p className="-rotate-2 font-hand text-2xl text-muted" style={{ animation: 'pop-in 0.8s ease-out 1.4s both' }}>откройте запись через год — и снова почувствуйте тот день</p>
            </div>
            <div className="flex justify-center" style={{ animation: 'pop-in 1s ease-out 0.4s both' }}>
              <MemoryMachine />
            </div>
          </section>
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
          <OpenDiaryButton />
        </section>
      </main>
    </PageFade>
  );
}
