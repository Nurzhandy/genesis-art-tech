// Лендинг (21.11): открыт для всех. «Начать» работает без регистрации — дневник заводится на устройстве,
// аккаунт нужен только чтобы открыть его на другом устройстве. Приёмы подсмотрены у дневников-ориентиров:
// «как вы сегодня?» и вопрос дня (Stoic, How We Feel), чередование «картинка — текст» и «в этот день»
// (Day One), честный список обещаний (mymind). Вошедший человек сразу уходит на /home.
import Link from 'next/link';
import { PageFade } from '@/components/fx/PageFade';
import { EntryIntro } from '@/components/fx/EntryIntro';
import { DiaryStrip } from '@/components/home/DiaryStrip';
import { LandingNav, LandingRedirect } from '@/components/home/LandingAuth';
import { MoodMarquee } from '@/components/home/MoodMarquee';
import { LandingHero } from '@/components/landing/LandingHero';
import { BoardDemo, OnThisDayDemo, SongDemo, VoiceDemo } from '@/components/landing/Showcase';
import { StartButton } from '@/components/landing/StartButton';

const ROWS = [
  { kicker: 'доска дня', title: 'Положите день на стол — как получится', text: 'Заметка, фото, песня, голосовое, капля настроения, рисунок и стикеры. В любом порядке, ничего не обязательно: хватит одной строчки. Потом — «Собрать день».', demo: <BoardDemo /> },
  { kicker: 'музыка', title: 'Песня задаёт ритм страницы', text: 'Темп песни становится ритмом кадров, её год — носителем: пластинка, кассета, CD. Медленный вечер и нервная ночь выглядят по-разному — сами собой.', demo: <SongDemo /> },
  { kicker: 'память', title: 'В этот день — год назад', text: 'Дневник сам напоминает, что было в этот день раньше. Цвета, песня, погода — и вы снова там. Можно запечатать день капсулой, чтобы открыть через год.', demo: <OnThisDayDemo /> },
  { kicker: 'голос', title: 'Нет сил писать? Расскажите', text: 'Пару минут голосом, как другу. Запись станет заметкой, а через год день расскажет вашим же голосом.', demo: <VoiceDemo /> },
];

const PROMISES = [
  ['Без регистрации', 'Начните за секунду. Аккаунт — только если захотите открыть дневник и с телефона.'],
  ['Без ленты и лайков', 'Никто не оценивает ваши дни, нет счётчиков и соревнований. Это место только для вас.'],
  ['Без оценки состояния', 'Настроение записи подбирает цвета страницы, а не ставит вам диагнозы.'],
  ['Всё можно забрать', 'Любой день скачивается папкой или удаляется. Что видит AI — написано прямо в форме.'],
];

const primaryBtn = 'rounded-full bg-foreground px-8 py-4 text-center font-mono text-sm uppercase tracking-[0.15em] text-background shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60';
const ghostBtn = 'rounded-full border border-foreground/30 px-8 py-4 text-center font-mono text-sm uppercase tracking-[0.15em] transition-colors hover:bg-foreground hover:text-background';

export default function Landing() {
  return (
    <PageFade>
      <LandingRedirect />
      <main className="flex flex-1 flex-col overflow-x-clip">
        <EntryIntro />
        <header className="sticky top-0 z-30 border-b border-foreground/5 bg-background/75 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="font-hand text-2xl leading-none sm:text-3xl">Дневник атмосферы</Link>
            <div className="flex items-center gap-1 sm:gap-2">
              <a href="#how" className="hidden rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-muted transition-colors hover:text-foreground md:inline-block">Как это работает</a>
              <LandingNav />
            </div>
          </div>
        </header>

        <LandingHero />

        <MoodMarquee />

        {/* Чередование «картинка — текст», каждая картинка оживает при прокрутке */}
        <section id="how" className="mx-auto flex w-full max-w-6xl scroll-mt-20 flex-col gap-24 px-4 py-24">
          {ROWS.map((r, i) => (
            <div key={r.kicker} className="grid items-center gap-10 md:grid-cols-2">
              <div className={`reveal flex flex-col gap-4 ${i % 2 ? 'md:order-2' : ''}`}>
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">{String(i + 1).padStart(2, '0')} · {r.kicker}</p>
                <h2 className="text-4xl font-semibold leading-tight sm:text-5xl">{r.title}</h2>
                <p className="max-w-md text-xl leading-relaxed text-muted">{r.text}</p>
              </div>
              <div className={`flex justify-center ${i % 2 ? 'md:order-1' : ''}`}>{r.demo}</div>
            </div>
          ))}
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-24">
          <div className="reveal mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">примеры</p>
              <h2 className="text-4xl font-semibold leading-tight sm:text-5xl">Один дневник — разные дни</h2>
            </div>
            <Link href="/diary/demo" className="font-mono text-xs uppercase tracking-[0.2em] text-muted underline-offset-4 hover:text-foreground hover:underline">полистать демо-дневник →</Link>
          </div>
          <DiaryStrip />
        </section>

        {/* Честный список обещаний (как у mymind): что здесь не будет происходить */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-24">
          <div className="rounded-3xl bg-foreground/[0.04] p-6 ring-1 ring-foreground/10 sm:p-10">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">наши обещания</p>
            <h2 className="mt-2 max-w-2xl text-4xl font-semibold leading-tight">Это ваш дневник, а не соцсеть</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PROMISES.map(([t, d], i) => (
                <div key={t} className="reveal flex flex-col gap-2" style={{ animationDelay: `${i * 80}ms` }}>
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-foreground text-background">✓</span>
                  <h3 className="text-xl font-semibold">{t}</h3>
                  <p className="text-base leading-relaxed text-muted">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="reveal mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 pb-28 text-center">
          <p className="font-hand text-5xl sm:text-6xl">Каким был ваш день?</p>
          <p className="max-w-md text-lg text-muted">Одна строчка, одно фото или одна песня — уже день. Начните сейчас, без регистрации.</p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <StartButton className={primaryBtn}>Начать бесплатно</StartButton>
            <Link href="/diary/demo" className={ghostBtn}>Смотреть демо</Link>
          </div>
        </section>
      </main>
    </PageFade>
  );
}
