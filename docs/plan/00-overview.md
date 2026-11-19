# Дневник атмосферы: план реализации (веб)

> Общий документ для всей команды. Задачи по людям лежат в двух файлах:
> - [Часть A: бэкенд, AI, ввод дня, архив](part-A-backend-input.md)
> - [Часть B: визуальная система, рендер, просмотр дня](part-B-visual-system.md)
>
> Шаги отмечаем чекбоксами (`- [ ]` → `- [x]`) прямо в этих файлах и коммитим вместе с кодом.

**Цель.** Веб-приложение: человек пишет о дне, прикладывает фото и песню, а система собирает
из этого анимированную вертикальную «страницу дневника» под музыку. Страница сохраняется в
папку дня с придуманным названием, а все дни складываются в архив-ленту.

**Архитектура в двух словах.** Next.js на Vercel: фронтенд и API-роуты живут в одном
проекте. Данные и файлы хранятся в Supabase (Postgres и приватный Storage). Claude один раз
разбирает день: текст, фото и описание песни превращаются в структурированный `DayAnalysis`
и название. Дальше работает **наш детерминированный движок правил**
`buildStyle()`: он превращает анализ, цвета фото и параметры музыки в `StyleParams`, где у
каждого решения записана причина. Воспоминание рисуется в браузере (p5.js) строго по
`StyleParams`. Поэтому один и тот же день всегда выглядит одинаково, и мы можем объяснить
каждое решение.

**Спека:** [docs/spec/genesis-art-tech-tz.pdf](../spec/genesis-art-tech-tz.pdf)

---

## 1. Стек

| Слой | Выбор | Почему |
|---|---|---|
| Фреймворк | **Next.js 16 (App Router) + TypeScript**. Перед кодом читать `node_modules/next/dist/docs/` (см. `AGENTS.md`) | Фронт и бэк в одном репо, деплой на Vercel в один клик |
| Стили UI | Tailwind CSS | Быстро, без своего CSS-фреймворка |
| БД и файлы | **Supabase** (Postgres + Storage, приватный bucket `days`) | Бесплатный тариф, signed URLs для загрузки напрямую из браузера |
| AI-анализ | **Gemini API**, `@google/genai`, модель `gemini-3.8-flash` (через env `GEMINI_MODEL`); решение от 19.11: Gemini вместо Claude | Мультимодальный разбор текста и фото за один вызов, structured output по zod-схеме |
| Музыка | oEmbed Spotify/YouTube (название, исполнитель) + **Deezer API** (`bpm`, официальный 30-сек `preview`) + анализ файла в браузере (`web-audio-beat-detector`, `meyda`) | Песня влияет на картинку, а целиком чужие треки мы не храним |
| Озвучка (плюс) | OpenAI TTS `gpt-4o-mini-tts` (голос и `instructions` под настроение), запасной вариант: Web Speech API в браузере | Управляемая интонация, хороший русский |
| Рендер | **p5.js** (instance mode) + один GLSL-шейдер для зерна и виньетки | Легко писать генеративную графику, есть WebGL |
| Шрифты | Cormorant Garamond (заголовок), JetBrains Mono (дата), Caveat (рукописная подпись) | Все с кириллицей, Google Fonts |
| Тесты | Vitest | Только для чистой логики: правила, валидация, парсеры |
| Деплой | Vercel (прод = ветка `main`) | Ссылка для жюри |

## 2. Структура репозитория

```
src/
  app/
    page.tsx                         A  лендинг → «Открыть мой дневник» / «Демо-дневник»
    diary/[diaryId]/page.tsx         A  архив: сетка по месяцам + режим «Лента»
    diary/[diaryId]/new/page.tsx     A  запись дня (форма)
    day/[dayId]/page.tsx             B  просмотр воспоминания + папка дня
    lab/page.tsx                     B  лаборатория стиля: фикстуры + ползунки
    lab/feed/page.tsx                B  проверка лентой: 5–7 дней рядом
    api/diaries/route.ts                       A  POST создать дневник
    api/diaries/[diaryId]/days/route.ts        A  GET список, POST черновик дня
    api/days/[dayId]/route.ts                  A  GET день (с signed URLs)
    api/days/[dayId]/uploads/route.ts          A  POST signed upload URLs (фото, thumb, аудио, постер)
    api/days/[dayId]/generate/route.ts         A  POST анализ → стиль → название → сохранение
    api/days/[dayId]/voice/route.ts            A  POST озвучка
    api/music/resolve/route.ts                 A  GET ?url= | ?q=  → SongRef + MusicFeatures
    api/music/preview/route.ts                 A  GET прокси 30-сек превью Deezer (CORS)
  lib/
    types.ts                  ОБЩИЙ  контракты (раздел 3), меняем только по договорённости
    supabase/server.ts        A
    storage.ts                A  пути папки дня, signed URLs
    validation.ts             A  zod-схемы входа API
    ai/client.ts, ai/analyzeDay.ts, ai/schemas.ts, ai/prompts.ts, ai/fallback.ts   A
    music/parseSongUrl.ts, music/resolve.ts, music/deezer.ts                       A
    voice/pickVoice.ts, voice/tts.ts                                               A
    title/validateTitle.ts    A
    client/api.ts             A  fetch-обёртки
    client/imageProcess.ts    A  сжатие, HEIC, PhotoFeatures
    client/audioAnalysis.ts   A  MusicFeatures из файла
    client/diaryId.ts         A  diaryId в localStorage
    style/buildStyle.ts       B  движок правил
    style/techniques.ts       B  скоринг техник
    style/palette.ts          B  палитра
    style/motion.ts           B  ритм и длительность
    style/constants.ts        B  постоянные элементы (сетка, шрифты, поля)
  render/                     B  MemoryCanvas.tsx, sketch.ts, layout.ts, timeline.ts,
                                 techniques/*.ts, fx/grain.frag, poster.ts, audioReactive.ts
  components/
    DayForm, PhotoPicker, SongInput, GenerateProgress, DayCard,
    ArchiveGrid, FeedStrip, FolderPanel                                   A
    MemoryPlayer, WhyPanel, VoiceButton                                   B
fixtures/days/*.json          B  входы для /lab и тестов (≥ 5 разных дней)
fixtures/demo/<slug>/         ОБЩИЙ  настоящие любимые дни команды: text.md, photos/, song.json
scripts/seed-demo.ts          A  прогон fixtures/demo через пайплайн в демо-дневник
supabase/migrations/0001_init.sql   A
docs/submission/              ОБЩИЙ  материалы для сдачи
```

## 3. Контракты (`src/lib/types.ts`)

Это главная точка синхронизации: A и B пишут код параллельно, опираясь на эти типы. Файл
создаётся в задаче 0 **ровно в таком виде**. Если тип нужно поменять, договариваемся в чате,
меняем одним коммитом и предупреждаем второго.

```ts
// ── Ввод ────────────────────────────────────────────────
export type SongProvider = 'spotify' | 'youtube' | 'yandex' | 'apple' | 'deezer' | 'soundcloud' | 'other';

export type SongRef =
  | { kind: 'link'; url: string; provider: SongProvider; title?: string; artist?: string;
      embedUrl?: string; previewUrl?: string; coverUrl?: string; year?: number }
  | { kind: 'file'; path: string; title?: string; artist?: string };

/** Считается в браузере (часть A) из сжатого фото. */
export interface PhotoFeatures {
  index: number;
  width: number; height: number;
  palette: string[];      // 5 hex по убыванию доли
  brightness: number;     // 0..1 (средняя яркость L*)
  warmth: number;         // -1 (холодно/синий) .. 1 (тепло/оранжевый)
  saturation: number;     // 0..1
}

export interface MusicFeatures {
  source: 'audio' | 'deezer' | 'llm';   // откуда взяли, по убыванию надёжности
  bpm: number;                          // 50..200
  energy: number;                       // 0..1
  mode: 'major' | 'minor' | 'unknown';
  brightness?: number;                  // 0..1 спектральный центроид, только source='audio'
  genre?: string;                       // латиницей, lower-case: 'jazz', 'electronic', ...
  year?: number;
}

// ── Анализ дня (выход Claude или fallback) ──────────────
export interface Mood {
  valence: number;     // -1..1  (грусть ↔ радость)
  arousal: number;     //  0..1  (покой ↔ возбуждение)
  tension: number;     //  0..1  (расслабленность ↔ напряжение, дедлайн)
  nostalgia: number;   //  0..1
}

export interface DayAnalysis {
  mood: Mood;
  moodWords: string[];                 // 3–5 русских слов: «уютный», «зябкий»
  season: 'winter' | 'spring' | 'summer' | 'autumn' | 'unknown';
  timeOfDay: 'morning' | 'day' | 'evening' | 'night' | 'unknown';
  setting: 'nature' | 'city' | 'indoor' | 'water' | 'transport' | 'mixed';
  people: 'alone' | 'pair' | 'group' | 'unknown';
  sensory: string[];                   // детали из текста: «запах какао», «шуршание листьев»
  photoScenes: { index: number; subject: string; light: 'warm' | 'cool' | 'neutral' | 'low' | 'harsh' }[];
  title: string;                       // 3–7 слов, см. правила названий
  caption: string;                     // рукописная подпись, ≤ 60 символов
  songGuess: { bpm: number; energy: number; mode: 'major' | 'minor'; genre: string; year: number } | null;
  source: 'claude' | 'fallback';
}

// ── Визуальная система ──────────────────────────────────
export type Technique = 'impressionist' | 'geometric' | 'minimal' | 'film' | 'collage';

export interface StyleInput {
  analysis: DayAnalysis;
  photos: PhotoFeatures[];
  music: MusicFeatures;
  date: string;          // ISO yyyy-mm-dd
  seed: number;          // стабильный, из dayId
}

export interface StyleReason { param: string; because: string }   // для панели «Почему так»

export interface StyleParams {
  version: 1;
  seed: number;
  techniques: { primary: Technique; secondary: Technique | null; mix: number /*0..1 доля secondary*/ ;
                scores: Record<Technique, number> };
  palette: { bg: string; paper: string; ink: string; accents: string[] /*3–5*/ };
  texture: { grain: number; paper: number; brush: number };              // 0..1
  composition: { density: number; negativeSpace: number; asymmetry: number;
                 photoFrame: 'soft' | 'hard' | 'torn' | 'none' };       // 0..1
  motion: { bpm: number; beatsPerPhoto: 2 | 4 | 8; jitter: number; easing: 'soft' | 'sharp' };
  typography: { titleWeight: 400 | 600 | 700; captionTilt: number /*градусы, -6..6*/ };
  durationSec: number;   // 20..45
  reasons: StyleReason[];
}

export interface VoicePreset { voice: string; speed: number; instructions: string; because: string }

// ── Хранение ────────────────────────────────────────────
export type DayStatus = 'draft' | 'generating' | 'ready' | 'error';

export interface DayRecord {
  id: string; diaryId: string;
  date: string; title: string | null; slug: string | null;
  text: string;
  photos: { path: string; thumbPath: string; url?: string; thumbUrl?: string; features: PhotoFeatures }[];
  song: SongRef; songUrl?: string;      // songUrl: signed URL файла/превью для <audio>
  music: MusicFeatures | null;
  analysis: DayAnalysis | null;
  style: StyleParams | null;
  voice: { path: string; url?: string; preset: VoicePreset } | null;
  posterPath: string | null; posterUrl?: string;
  status: DayStatus; error: string | null;
  createdAt: string;
}
```

## 4. Как день проходит через систему

```
[Браузер, A]                                   [Сервер, A]                      [Браузер, B]
текст + дата ───────────┐
фото → сжатие 1600/768px│ POST /days (черновик)
     → PhotoFeatures    ├──────────────────► days(status=draft)
песня: ссылка → resolve │ POST /uploads ─► signed URLs ─► PUT файлов в Storage
       файл → BPM/energy│ POST /generate {photoFeatures, music?}
                        └──────────────────► analyzeDay (Claude: текст + 768px-фото + песня)
                                             ↳ refusal/timeout → fallback-анализ
                                             merge music: audio > deezer > llm
                                             buildStyle()  ← код части B
                                             validateTitle() → slug
                                             status=ready ──────────────────► /day/[id]
                                                                              «▶ Открыть день»
                                                                              MemoryCanvas(style, photos, audio)
                                                                              exportPoster() → PUT poster
                                             POST /voice (по кнопке или сразу)
```

**Папка дня** в Storage: `days/{diaryId}/{date}-{slug}/`
`text.md`, `photos/01.jpg…`, `photos/thumb/01.jpg…`, `song.json` (+ `song.<ext>` только если
это собственный файл пользователя), `analysis.json`, `style.json`, `memory.png`, `voice.mp3`.
Черновик пишется в `days/{diaryId}/_draft-{dayId}/`. После генерации название известно, и
сервер копирует файлы в итоговую папку. В UI это показывается как «Папка дня», а кнопка
«Скачать папку» отдаёт ZIP.

## 5. Визуальная система (кратко, подробности в части B)

**Постоянное** (одинаково у всех дней): холст 9:16 (1080×1920 логических px), поля 8%,
верхняя плашка: дата моноширинным шрифтом и номер дня в дневнике, название Cormorant
Garamond, рукописная подпись Caveat внизу, окно для фото в одной и той же зоне сетки,
бумажная подложка.

**Переменное:** техника и её смесь, палитра, фактура (зерно, бумага, мазок), плотность и
пустота, рамка фото, ритм смены кадров по BPM, характер движения.

**Пять техник:**

| Техника | Когда включается | Почему передаёт это ощущение |
|---|---|---|
| Импрессионизм (мазки и свет Моне) | спокойно и светло, природа и вода, тёплый свет, джаз, классика, свинг | Мазок растворяет контуры: день вспоминается как ощущение света, а не как набор деталей |
| Геометрия Кандинского | высокая энергия и напряжение, город или ночь, электроника | Линии и пятна в жёсткой сетке дают ритм и собранность, а резкие склейки идут в долю |
| Японский минимализм (ма) | тихо, один, грусть или созерцание, эмбиент | Пустота даёт «воздух», внимание падает на один кадр |
| Плёнка | ностальгия, песня до 2000 года, близкие люди | Зерно, засветки и тёплый сдвиг воспринимаются как «это было давно и дорого» |
| Коллаж | весёлый насыщенный день, много фото и людей, поп, хип-хоп | Наложения и рваные края передают «всего было много и сразу» |

Песня **влияет на форму**, а не просто играет фоном:
- BPM задаёт ритм смены кадров;
- энергия меняет длину мазков, дрожание и количество фигур;
- минор приглушает цвета и добавляет пустоты;
- год выпуска добавляет зерно;
- жанр сдвигает выбор техники;
- если аудио доступно в браузере (свой файл или превью Deezer), анимация ещё и пульсирует от громкости.

## 6. План по дням (сегодня 19 ноября, дедлайн 22 ноября 23:59 по Астане)

| Когда | A | B | Контрольная точка |
|---|---|---|---|
| **19 ноя, вечер** | Задача 0: каркас, Supabase, деплой пустышки | Фикстуры 5 дней, черновик таблицы правил | Пустой сайт открывается по ссылке Vercel. Каждый записал свой любимый день (текст, 3–5 фото, песня) в `fixtures/demo/` |
| **20 ноя** | API, Claude-анализ, форма на реальном API | `buildStyle` с тестами, рендер-каркас, 3 техники (импрессионизм, геометрия, минимализм) в `/lab` | **Вечер: интеграция №1.** Один день проходит путь «форма → генерация → просмотр» |
| **21 ноя** | Музыка (Deezer, анализ файла), озвучка, архив и лента, ZIP, сид демо | Плёнка, коллаж, смешивание техник, постер, аудиореактивность, «Почему так», тюнинг ленты в `/lab/feed` | **Вечер: интеграция №2.** 5–7 демо-дней в прод-дневнике `demo`, лента смотрится цельно |
| **22 ноя** | Фиксы, README, tools.md | Фиксы, techniques.md, примеры дней (PNG и запись экрана) | **16:00 код-фриз. 16:00–20:00 видео до 3 минут и описание. До 21:00 сдать** (запас до 23:59) |

## 7. Глобальные ограничения (из ТЗ, обязательны для всех задач)

- Ввод: текст о дне, **минимум одно фото** (мы ограничиваем 1–5) и **песня ссылкой или файлом**.
- Воспоминание строится из ввода, а не выбирается случайно из готовых шаблонов.
- Музыка **заметно влияет на оформление и звучит** при просмотре записи.
- Каждый день хранится в отдельной папке с коротким названием, которое придумывает система. Название **3–7 слов**, все названия в одном тоне.
- Архив: можно вернуться к любому прошлому дню.
- В демо **минимум 3 дня с разным настроением**. Цель: 5–7 дней, которые рядом смотрятся как дневник одного человека.
- Чужие песни **не храним и не раздаём целиком**: только ссылки, embed, официальные 30-сек фрагменты Deezer, свои файлы пользователя в приватном bucket или треки со свободной лицензией.
- Голоса только синтезированные, без клонирования реальных людей.
- Вдохновляемся стилями, но **не копируем конкретные работы** современных авторов.
- Тексты в UI: «настроение записи», а **не** «ваше эмоциональное состояние». Никакой «диагностики».
- В демо только свои или добровольно предоставленные тексты и фото.
- Все библиотеки, API и AI-инструменты перечисляем в `docs/submission/tools.md`.
- Сдача: ссылка на прототип, видео до 3 минут, 3–7 примеров дней с названиями папок, описание до 1 страницы, список художественных приёмов, репозиторий, список инструментов.

## 8. На что смотреть при ревью (тестов на это нет, легко сломать)

1. **HEIC с iPhone.** Браузер не умеет декодировать HEIC → конвертируем через `heic2any`, при ошибке показываем понятное сообщение. Тест: `imageProcess` → HEIC-файл даёт JPEG или ошибку с текстом (задача A4).
2. **Очень короткий текст** («норм день»). Анализ всё равно возвращает валидный `DayAnalysis`, а `buildStyle` выдаёт нейтральный, но красивый стиль. Тесты: `fallback.test.ts` (A3) и кейс «neutral» в `buildStyle.test.ts` (B1).
3. **Песню не удалось распознать** (приватная ссылка, нет на Deezer, YouTube без исполнителя). Цепочка `audio → deezer → llm → дефолт {bpm: 90, energy: 0.5, mode: 'unknown'}`, генерация не падает. Тест в `resolve.test.ts` (A5).
4. **Claude недоступен, отказал или думает дольше 45 с.** Срабатывает fallback-анализ, и день всё равно получает `status=ready`. При любой другой ошибке ставим `status=error` и показываем кнопку «Повторить». Тест: `analyzeDay` с замоканным отказом → `source: 'fallback'` (A3).
5. **Автоплей.** Браузеры блокируют звук без клика, поэтому просмотр всегда начинается с кнопки «▶ Открыть день», которая одновременно запускает аудио и анимацию. Проверка вручную в Safari iOS и Chrome (B5).

## 9. Как работаем с git

- `main` всегда рабочий, каждый пуш в него деплоится на Vercel.
- Ветки: `a/<задача>` и `b/<задача>`, например `a/api-days`, `b/impressionist`.
- Маленькие PR, вливаем сами после быстрого просмотра вторым человеком (или сразу, если горит).
- `src/lib/types.ts` меняем только по договорённости и отдельным коммитом `types: ...`.
- Секреты только в `.env.local` и в Vercel env, **никогда в git**. Шаблон: `.env.example`.

### Переменные окружения (`.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # для загрузки файлов по signed URL из браузера
SUPABASE_SERVICE_ROLE_KEY=          # только сервер
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
OPENAI_API_KEY=                     # озвучка, необязательно
DEMO_DIARY_ID=demo
GENERATE_LIMIT_PER_DAY=30
```

---

## Задача 0. Каркас проекта (A, вечер 19 ноября, ~2 часа). Блокирует всех

**Files:** весь каркас, `src/lib/types.ts`, `.env.example`, `vitest.config.ts`, `supabase/migrations/0001_init.sql`

- [x] `npx create-next-app@latest . --ts --tailwind --app --src-dir --eslint --import-alias "@/*"`
- [x] `npm i @supabase/supabase-js @anthropic-ai/sdk zod p5 jszip heic2any web-audio-beat-detector meyda`
- [x] `npm i -D vitest @types/p5` (по факту: `@types/p5` не нужен, у p5 v2 свои типы; `@types/node@^24` для vitest 5), в `package.json` добавить `"test": "vitest run"`
- [x] Создать `src/lib/types.ts` дословно из раздела 3, создать `.env.example` из раздела 9
- [x] Подключить шрифты через `next/font/google` в `src/app/layout.tsx`: Cormorant Garamond (400, 600, 700), JetBrains Mono, Caveat, все с `subsets: ['latin', 'cyrillic']`
- [x] Проверка: `npm run build` и `npm test` проходят (тестов пока 0, это нормально)
- [x] Подключить репозиторий к Vercel, добавить env, убедиться, что прод-ссылка открывается (https://genesis-art-tech.vercel.app)
- [x] Коммит `chore: scaffold next app, shared types` и пуш в `main`
