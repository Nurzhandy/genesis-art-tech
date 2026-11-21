// Что умеет дневник: каждая плитка окрашена палитрой одного из настоящих дней, а не случайным цветом.
import Link from 'next/link';
import { demoDays } from './demoDays';

const FEATURES = [
  { title: 'Рассказать голосом', text: 'Пару минут как другу. AI перепишет красиво — или оставит, как вы сказали.', href: '#tell', big: true },
  { title: 'Песня меняет страницу', text: 'Темп задаёт ритм кадров, год — носитель: пластинка, кассета, CD.', href: '/lab', big: true },
  { title: 'Что вы чувствовали', text: 'Шкала эмоций в четырёх цветах: одно слово — и страница берёт цвета этого чувства.', href: '#tell' },
  { title: 'Мысли', text: 'Цитата, ссылка, идея — без дня и фото. Метка ставится сама, всё находится поиском.', href: '/thoughts' },
  { title: 'Атлас дней', text: 'Карта настроения дневника: теплее, холоднее, живее, спокойнее.', href: '/diary/demo' },
  { title: 'Книга', text: 'Дневник листается как настоящий, разворот за разворотом.', href: '/diary/demo' },
  { title: 'Капсула времени', text: 'Запечатайте день — он откроется через год.', href: '/diary/demo' },
  { title: 'Свой голос', text: 'Через год день расскажет вашим же голосом.', href: '/diary/demo' },
  { title: 'Погода того дня', text: 'Дождь, снег и мороз сами появляются в кадре.', href: '/diary/demo' },
  { title: 'Подарок одним днём', text: 'Отправьте близкому ссылку на один день — как открытку.', href: '/diary/demo' },
  { title: 'Видео дня', text: '15, 30 или 60 секунд под вашу песню — для сторис.', href: '/diary/demo' },
  { title: 'Доска и стикеры', text: 'Украшайте страницу сами: заметки, кисть, стрелки, рамки.', href: '/diary/demo' },
];

export function FeatureBento() {
  const days = demoDays();
  return (
    <section id="features" className="mx-auto w-full max-w-6xl px-4 py-20">
      <h2 className="reveal max-w-2xl text-5xl font-semibold leading-tight">Всё, чтобы день остался с вами</h2>
      <p className="reveal mt-3 max-w-xl text-xl leading-relaxed text-muted">Каждая плитка окрашена цветами одного из дней демо-дневника — так выглядят ваши будущие страницы.</p>
      <div className="mt-10 grid auto-rows-[minmax(170px,auto)] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => {
          const d = days[i % days.length];
          const [a, b] = [d.style.palette.accents[0], d.style.palette.accents[1] ?? d.style.palette.accents[0]];
          return (
            <Link key={f.title} href={f.href}
              className={`bento-tile reveal group relative flex flex-col justify-end overflow-hidden rounded-2xl p-6 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-2xl ${f.big ? 'sm:col-span-2 lg:row-span-2' : ''}`}
              style={{ background: `radial-gradient(120% 90% at 15% 10%, ${b}, transparent 60%), linear-gradient(135deg, ${a}, ${d.style.palette.ink})` }}>
              <span aria-hidden className="bento-glow absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-40 blur-2xl transition-transform duration-700 group-hover:scale-150" style={{ background: b }} />
              <h3 className={`relative font-semibold leading-tight [text-shadow:0_1px_10px_rgba(0,0,0,0.35)] ${f.big ? 'text-4xl' : 'text-2xl'}`}>{f.title}</h3>
              <p className={`relative mt-2 leading-snug text-white/85 ${f.big ? 'text-xl' : 'text-base'}`}>{f.text}</p>
              <p className="relative mt-3 font-hand text-lg text-white/70">{d.title}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
