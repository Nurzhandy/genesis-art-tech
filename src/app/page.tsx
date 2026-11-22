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
import { LandingMotion } from '@/components/landing/LandingMotion';
import { SmoothScroll } from '@/components/fx/SmoothScroll';
import ScrollReveal from '@/components/react-bits/ScrollReveal';
import StickerPeel from '@/components/react-bits/StickerPeel';
import ClickSpark from '@/components/react-bits/ClickSpark';

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

const primaryBtn = 'rounded-full bg-foreground px-8 py-4 text-center text-xl text-background shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60';
const ghostBtn = 'rounded-full border border-foreground/30 px-8 py-4 text-center text-xl transition-colors hover:bg-foreground hover:text-background';

export default function Landing() {
  return (
    <PageFade>
      <LandingRedirect />
      <ClickSpark sparkColor={['#e0b84d', '#f3c969', '#efe2cf']} shape="star" sparkCount={9} sparkRadius={28} sparkSize={9} glow={0.6} className="flex flex-1 flex-col">
      <main className="flex flex-1 flex-col overflow-x-clip">
        <EntryIntro />
        <SmoothScroll />
        <LandingMotion />
        <header className="sticky top-0 z-30 border-b border-foreground/5 bg-background/75 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="font-hand text-2xl leading-none sm:text-3xl">Дневник атмосферы</Link>
            <div className="flex items-center gap-1 sm:gap-2">
              <a href="#how" className="hidden rounded-full px-4 py-2 text-lg text-muted transition-colors hover:text-foreground md:inline-block">Как это работает</a>
              <LandingNav />
            </div>
          </div>
        </header>

        <div data-motion="hero"><LandingHero /></div>

        <MoodMarquee />

        {/* Манифест: слова поднимаются из-под строки и на миг вспыхивают тёплым светом (React Bits · ScrollReveal) */}
        <section className="mx-auto w-full max-w-4xl px-4 pt-28">
          <ScrollReveal effect="rise" splitBy="words" baseRotation={0} baseOpacity={0.08} blurStrength={6} stagger={0.06} highlightColor="#e0b84d"
            containerClassName="!my-0" textClassName="!text-[clamp(2rem,5.2vw,4.2rem)] !leading-[1.15] !font-semibold">
            Фото помнят, как выглядел день. Дневник помнит, как он ощущался: свет, погоду, песню и тех, кто был рядом.
          </ScrollReveal>
        </section>

        {/* Чередование «картинка — текст», каждая картинка оживает при прокрутке */}
        <section id="how" className="mx-auto flex w-full max-w-6xl scroll-mt-20 flex-col gap-24 px-4 py-24">
          {ROWS.map((r, i) => (
            <div key={r.kicker} className="grid items-center gap-10 md:grid-cols-2">
              <div className={`flex flex-col gap-4 ${i % 2 ? 'md:order-2' : ''}`}>
                <p className="font-hand text-2xl leading-none text-muted">{r.kicker}</p>
                <h2 data-motion="split" className="text-4xl font-semibold leading-tight sm:text-5xl">{r.title}</h2>
                <p className="max-w-md text-xl leading-relaxed text-muted">{r.text}</p>
              </div>
              <div data-motion="demo" data-side={i % 2 ? 'left' : 'right'} className={`flex justify-center ${i % 2 ? 'md:order-1' : ''}`}>{r.demo}</div>
            </div>
          ))}
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-24">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 data-motion="split" className="text-4xl font-semibold leading-tight sm:text-5xl">Один дневник — разные дни</h2>
            <Link href="/diary/demo" className="text-xl text-muted underline decoration-foreground/25 underline-offset-4 hover:text-foreground hover:decoration-foreground">Полистать демо-дневник</Link>
          </div>
          <DiaryStrip />
        </section>

        {/* Честный список обещаний (как у mymind): лист бумаги со скотчем, обещания — от руки */}
        <section className="mx-auto w-full max-w-4xl px-4 pb-28">
          <div data-motion="paper" className="relative rotate-[-0.6deg] bg-[#fbf8f1] px-6 pb-10 pt-12 text-[#2b241c] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)] [--muted:#7a7064] sm:px-14">
            <span className="absolute -top-3 left-10 h-7 w-28 rotate-[-4deg] bg-[#e8d9a8]/85" aria-hidden />
            <span className="absolute -top-3 right-12 h-7 w-24 rotate-[5deg] bg-[#e8d9a8]/85" aria-hidden />
            <div className="pointer-events-auto absolute -right-6 -top-12 z-10 h-36 w-36 sm:-right-10 sm:-top-14 sm:h-44 sm:w-44">
              <StickerPeel imageSrc="/stickers/only-yours.svg" width={150} rotate={12} finish="gloss" backColor="#efe4cf" peelDirection={225} />
            </div>
            <h2 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">Это ваш дневник, а не соцсеть</h2>
            <ul className="mt-8 grid gap-x-12 gap-y-7 sm:grid-cols-2">
              {PROMISES.map(([t, d]) => (
                <li key={t}>
                  <p className="font-hand text-3xl leading-tight">{t}</p>
                  <p className="mt-1 text-lg leading-relaxed text-muted">{d}</p>
                </li>
              ))}
            </ul>
            <p className="mt-10 text-right font-hand text-2xl text-muted">— команда «Дневника атмосферы»</p>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 pb-28 text-center">
          <p data-motion="finale" className="font-hand text-5xl sm:text-6xl">Каким был ваш день?</p>
          <p className="max-w-md text-lg text-muted">Одна строчка, одно фото или одна песня — уже день. Начните сейчас, без регистрации.</p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <StartButton className={primaryBtn}>Начать</StartButton>
            <Link href="/diary/demo" className={ghostBtn}>Смотреть демо</Link>
          </div>
        </section>
      </main>
      </ClickSpark>
    </PageFade>
  );
}
