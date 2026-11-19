# Часть A: бэкенд, AI, ввод дня, архив

> Общий контекст, контракты и таймлайн: [00-overview.md](00-overview.md). Все типы берём из
> `src/lib/types.ts`. Если какого-то типа не хватает, договариваемся с B, а не заводим свой.

**Зона ответственности A:** всё, что принимает день от человека, понимает его, хранит и
находит. Это каркас (задача 0 из обзора), Supabase, API, Claude-анализ, музыка, озвучка,
форма записи, загрузки, архив и лента, папка дня с ZIP, деплой и сид демо-дневника.

**Что A отдаёт B:** `DayRecord` из `GET /api/days/[dayId]` (с signed URLs фото, аудио и
голоса), signed URL для загрузки постера, вызов `buildStyle()` внутри `/generate`.

**Что A берёт у B:** `buildStyle(input: StyleInput): StyleParams` из `@/lib/style/buildStyle`.
Пока B его не сделал, вызываем заглушку `buildStyleStub()`, которая возвращает
`fixtures/style-stub.json`. Заглушку кладёт B в первый же час.

**Порядок:** A1 → A2 → A3 → A4 (к интеграции №1 вечером 20-го) → A5 → A6 → A7 → A8 → A9.

---

### A1. Supabase: схема, хранилище, серверный клиент

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `src/lib/supabase/server.ts`, `src/lib/storage.ts`
- Test: `src/lib/storage.test.ts`

**Interfaces:**
- Produces: `supabaseAdmin(): SupabaseClient` (service role, только на сервере);
  `dayFolder(diaryId: string, date: string, slug: string | null, dayId: string): string`;
  `signRead(paths: string[], ttlSec?: number): Promise<Record<string, string>>`;
  `signUpload(path: string): Promise<{ path: string; token: string; signedUrl: string }>`

- [ ] Создать проект Supabase (регион Frankfurt), скопировать URL и service role key в `.env.local` и Vercel
- [ ] Миграция `0001_init.sql`:
  - `diaries(id text primary key, created_at timestamptz default now())`
  - `days(id uuid pk default gen_random_uuid(), diary_id text references diaries, date date not null, title text, slug text, text text not null, photos jsonb not null default '[]', song jsonb not null, music jsonb, analysis jsonb, style jsonb, voice jsonb, poster_path text, status text not null default 'draft', error text, created_at timestamptz default now())`
  - индекс `days(diary_id, date desc)`
  - RLS включён, политик нет: всё идёт только через наши API-роуты с service role
  - `insert into diaries(id) values ('demo')`
- [ ] Bucket `days`, **private**, лимит файла 15 MB
- [ ] Тест `dayFolder`:
  ```ts
  expect(dayFolder('d1', '2026-11-03', 'osenniy-park-i-kakao', 'x')).toBe('d1/2026-11-03-osenniy-park-i-kakao')
  expect(dayFolder('d1', '2026-11-03', null, 'abc')).toBe('d1/_draft-abc')
  ```
- [ ] `npm test -- storage` → PASS
- [ ] Коммит `feat(db): schema, storage helpers`

### A2. API дневника и дня

**Files:**
- Create: `src/lib/validation.ts`, `src/app/api/diaries/route.ts`, `src/app/api/diaries/[diaryId]/days/route.ts`, `src/app/api/days/[dayId]/route.ts`, `src/app/api/days/[dayId]/uploads/route.ts`, `src/lib/client/api.ts`, `src/lib/client/diaryId.ts`
- Test: `src/lib/validation.test.ts`

**Interfaces:**
- `POST /api/diaries` → `{ diaryId }` (uuid v4; это одновременно «ключ» к дневнику, логина нет)
- `GET /api/diaries/[diaryId]/days?q=` → `DayRecord[]` (только `ready`, сортировка по дате убыв., `q` ищет по title и text через `ilike`, отдаются `posterUrl`/`thumbUrl`)
- `POST /api/diaries/[diaryId]/days` body `NewDayInput` → `{ dayId }`
- `GET /api/days/[dayId]` → `DayRecord` со всеми signed URLs (TTL 1 час)
- `POST /api/days/[dayId]/uploads` body `{ files: { kind: 'photo'|'thumb'|'audio'|'poster'; index?: number; ext: string }[] }` → `{ uploads: { kind; index?; path; token; signedUrl }[] }`
- Клиент: `api.createDay()`, `api.requestUploads()`, `api.uploadFile(signedUrl, token, blob)` (через `supabase.storage.from('days').uploadToSignedUrl` с anon-клиентом), `api.generate()`, `api.getDay()`, `api.listDays()`, `api.voice()`; `getOrCreateDiaryId(): Promise<string>` (localStorage `diaryId`)

- [ ] Тесты zod-схемы `NewDayInput = { date: 'yyyy-mm-dd', text: 1..5000 симв., photoCount: 1..5, song: SongRef }`:
  ```ts
  expect(NewDayInput.safeParse({ ...ok, text: '' }).success).toBe(false)
  expect(NewDayInput.safeParse({ ...ok, photoCount: 0 }).success).toBe(false)
  expect(NewDayInput.safeParse({ ...ok, photoCount: 6 }).success).toBe(false)
  expect(NewDayInput.safeParse({ ...ok, song: { kind: 'link', url: 'not a url', provider: 'other' } }).success).toBe(false)
  expect(NewDayInput.safeParse(ok).success).toBe(true)
  ```
- [ ] Тест: upload-запрос с `ext` не из `jpg|jpeg|png|webp|mp3|m4a|wav|ogg` отклоняется
- [ ] Реализовать роуты. Дневник `demo` **только для чтения**: POST в него → 403
- [ ] Проверка curl-ом: создать дневник → черновик → upload URLs → `GET` дня возвращает `status: 'draft'`
- [ ] Коммит `feat(api): diaries, days, signed uploads`

### A3. Claude-анализ дня и fallback

**Files:**
- Create: `src/lib/ai/client.ts`, `src/lib/ai/schemas.ts`, `src/lib/ai/prompts.ts`, `src/lib/ai/analyzeDay.ts`, `src/lib/ai/fallback.ts`, `src/lib/title/validateTitle.ts`
- Test: `src/lib/ai/fallback.test.ts`, `src/lib/ai/analyzeDay.test.ts`, `src/lib/title/validateTitle.test.ts`

**Interfaces:**
- Produces: `analyzeDay(input: { text: string; date: string; photos: { base64: string; mediaType: 'image/jpeg' }[]; song: SongRef }): Promise<DayAnalysis>`;
  `fallbackAnalysis(text: string, date: string, photos: PhotoFeatures[]): DayAnalysis`;
  `validateTitle(t: string): { ok: true; title: string } | { ok: false; reason: string }`;
  `slugify(title: string): string` (транслит, lower-case, дефисы)

- [ ] Тесты `validateTitle`:
  ```ts
  expect(validateTitle('Осенний парк и какао')).toEqual({ ok: true, title: 'Осенний парк и какао' })
  expect(validateTitle('Ночь в офисе перед сдачей').ok).toBe(true)
  expect(validateTitle('Парк').ok).toBe(false)                                     // < 3 слов
  expect(validateTitle('Очень длинный день в котором случилось всё сразу').ok).toBe(false) // > 7
  expect(validateTitle('«Осенний парк и какао».')).toEqual({ ok: true, title: 'Осенний парк и какао' }) // чистит кавычки, точку, эмодзи
  expect(slugify('Осенний парк и какао')).toBe('osenniy-park-i-kakao')
  ```
- [ ] Тесты fallback (раздел 8 обзора, п. 2):
  ```ts
  const a = fallbackAnalysis('норм день', '2026-11-19', [photo({ warmth: 0.1, brightness: 0.5 })])
  expect(a.source).toBe('fallback')
  expect(a.season).toBe('autumn')                       // из даты
  expect(validateTitle(a.title).ok).toBe(true)          // «Осенний день без особых событий»
  expect(a.mood.valence).toBeGreaterThanOrEqual(-1); expect(a.mood.valence).toBeLessThanOrEqual(1)
  ```
  Fallback: сезон по дате, время суток по словам («ночь», «утро», «вечер»), valence и arousal по маленькому словарю (≈40 слов: «устал», «дедлайн», «смеялись», «тихо» …) и средней яркости и теплоте фото. Название собирается по шаблону `[Сезонное прилагательное] [время суток / место] …`.
- [ ] Схема `DayAnalysisSchema` (zod) один в один повторяет `DayAnalysis`, только без `source`. Числа ограничены через `.min().max()`
- [ ] `analyzeDay`: **один** вызов
  ```ts
  client.messages.parse({
    model: process.env.CLAUDE_MODEL ?? 'claude-opus-5-5',
    max_tokens: 4000,
    output_config: { effort: 'medium', format: zodOutputFormat(DayAnalysisSchema) },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: [...photoBlocks /* type:'image', base64, 768px */, { type: 'text', text: userBlock }] }],
  })
  ```
  Перед чтением проверяем `stop_reason`: если `'refusal'` или `parsed_output === null`, уходим в fallback. Таймаут клиента 45 с, `maxRetries: 1`, при любой ошибке тоже fallback. Server-side fallbacks (`betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default'`) подключаем, только если `client.beta.messages.parse` их нормально типизирует. Если нет, хватает нашего локального fallback.
- [ ] `SYSTEM_PROMPT` (в `prompts.ts`) задаёт:
  - роль: «редактор личного дневника, переводишь день в параметры настроения, а не ставишь диагноз»;
  - шкалы `Mood` с якорями: «дедлайн ночью: tension 0.8, arousal 0.7»; «тихий вечер с какао: valence 0.6, arousal 0.2»;
  - **правила названия:** 3–7 слов, по-русски, именная фраза без глагола, без кавычек и эмодзи, шаблон «время/сезон + место + одна живая деталь»; примеры: «Осенний парк и какао», «Ночь в офисе перед сдачей», «Первый снег у бабушки»;
  - правило подписи: ≤ 60 символов, от первого лица, как рукой на полях;
  - `songGuess`: оценка по исполнителю и названию (BPM, энергия, лад, жанр латиницей, год). Если песня неизвестна, `null`.
- [ ] Если название из Claude не проходит `validateTitle`, берём `fallbackAnalysis(...).title` (повторный вызов ради названия не делаем: экономим время)
- [ ] Тест `analyzeDay` с замоканным SDK, который возвращает `stop_reason: 'refusal'` → результат `source: 'fallback'` (раздел 8, п. 4)
- [ ] Ручная проверка на 3 фикстурах из `fixtures/demo`. Анализ кладём в `fixtures/analysis-samples/*.json`, чтобы B видел реальные данные
- [ ] Коммит `feat(ai): day analysis with fallback, title rules`

### A4. Форма записи дня: фото и песня в браузере

**Files:**
- Create: `src/lib/client/imageProcess.ts`, `src/lib/client/audioAnalysis.ts`, `src/components/DayForm.tsx`, `src/components/PhotoPicker.tsx`, `src/components/SongInput.tsx`, `src/app/diary/[diaryId]/new/page.tsx`
- Test: `src/lib/client/imageProcess.test.ts`

**Interfaces:**
- Produces: `processPhoto(file: File, index: number): Promise<{ full: Blob; thumb: Blob; thumbBase64: string; features: PhotoFeatures }>`;
  `computeFeatures(pixels: Uint8ClampedArray, w: number, h: number, index: number): PhotoFeatures` (чистая функция, её и тестируем);
  `analyzeAudioFile(file: File): Promise<MusicFeatures>` (`source: 'audio'`)

- [ ] Тесты `computeFeatures` на синтетических пикселях:
  ```ts
  const orange = solid(255, 140, 0), blue = solid(30, 60, 200), black = solid(0, 0, 0)
  expect(computeFeatures(orange, 10, 10, 0).warmth).toBeGreaterThan(0.5)
  expect(computeFeatures(blue, 10, 10, 0).warmth).toBeLessThan(-0.5)
  expect(computeFeatures(black, 10, 10, 0).brightness).toBeLessThan(0.05)
  expect(computeFeatures(orange, 10, 10, 0).palette[0]).toBe('#ff8c00')
  ```
  Палитра: k-means на 5 кластеров по выборке ~2000 пикселей в Lab, сортировка по размеру кластера. Теплота: `(a* + b*) / норма` в Lab, клампим в [-1, 1].
- [ ] `processPhoto`: если HEIC, конвертируем через `heic2any`, при ошибке бросаем `Error('Не получилось открыть фото HEIC — сохраните его как JPEG')`. Затем ресайз через canvas: full 1600px по длинной стороне (JPEG 0.85), thumb 768px (JPEG 0.8). Учитываем EXIF-ориентацию (`createImageBitmap(file, { imageOrientation: 'from-image' })`)
- [ ] `analyzeAudioFile`: `decodeAudioData` → `guess()` из `web-audio-beat-detector` даёт BPM (при ошибке 90). Energy считаем через Meyda `rms` по окнам 60-секундного куска из середины трека, нормируем: `clamp(rms / 0.25)`. Brightness: `spectralCentroid / (sampleRate / 2)`. `mode: 'unknown'`
- [ ] Форма:
  - дата (по умолчанию сегодня);
  - textarea с подсказкой «Расскажите как другу: погода, свет, запахи, звуки, кто был рядом, мелочи, которые запомнились»;
  - PhotoPicker на 1–5 фото: превью, удаление, перестановка, а пока идёт обработка, кнопка «Собрать день» отключена;
  - SongInput с вкладками «Ссылка» / «Файл». По ссылке сразу вызываем `/api/music/resolve` и показываем карточку «Frank Sinatra — Autumn Leaves ✓». Под вкладкой «Файл» мелкий текст «файл виден только вам».
- [ ] Ручная проверка: HEIC с iPhone, вертикальное фото, PNG 12 MB, ссылка Spotify, ссылка YouTube, mp3
- [ ] Коммит `feat(form): day entry with photo and audio analysis`

### A5. Музыка: распознавание ссылки, Deezer, прокси превью

**Files:**
- Create: `src/lib/music/parseSongUrl.ts`, `src/lib/music/deezer.ts`, `src/lib/music/resolve.ts`, `src/app/api/music/resolve/route.ts`, `src/app/api/music/preview/route.ts`
- Test: `src/lib/music/parseSongUrl.test.ts`, `src/lib/music/resolve.test.ts`

**Interfaces:**
- Produces: `parseSongUrl(url: string): { provider: SongProvider; id?: string; embedUrl?: string } | null`;
  `resolveSong(url: string): Promise<{ song: SongRef; music: MusicFeatures | null }>`;
  `mergeMusic(audio: MusicFeatures | null, deezer: MusicFeatures | null, guess: DayAnalysis['songGuess']): MusicFeatures`;
  `GET /api/music/preview?id=<deezerTrackId>` стримит mp3 (берём свежий `preview` через `api.deezer.com/track/{id}`, потому что подпись ссылки истекает)

- [ ] Тесты `parseSongUrl`:
  ```ts
  expect(parseSongUrl('https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp?si=x')).toMatchObject({ provider: 'spotify', id: '3n3Ppam7vgaVa1iaRUc9Lp', embedUrl: 'https://open.spotify.com/embed/track/3n3Ppam7vgaVa1iaRUc9Lp' })
  expect(parseSongUrl('https://youtu.be/dQw4w9WgXcQ')).toMatchObject({ provider: 'youtube', id: 'dQw4w9WgXcQ' })
  expect(parseSongUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toMatchObject({ provider: 'youtube', id: 'dQw4w9WgXcQ' })
  expect(parseSongUrl('https://music.yandex.ru/album/1/track/2')).toMatchObject({ provider: 'yandex' })
  expect(parseSongUrl('https://www.deezer.com/track/3135556')).toMatchObject({ provider: 'deezer', id: '3135556' })
  expect(parseSongUrl('просто текст')).toBeNull()
  ```
- [ ] Тесты `mergeMusic` (раздел 8, п. 3):
  ```ts
  expect(mergeMusic(null, null, null)).toEqual({ source: 'llm', bpm: 90, energy: 0.5, mode: 'unknown' })
  expect(mergeMusic(audioF, deezerF, guess).source).toBe('audio')      // audio приоритетнее
  expect(mergeMusic(null, { ...deezerF, bpm: 0 }, guess).bpm).toBe(guess.bpm)  // у Deezer bpm=0 означает «нет данных»
  ```
  Лад (`mode`) и жанр всегда берём из `songGuess`, если в источнике выше их нет.
- [ ] `resolveSong`:
  1. Название и исполнитель через oEmbed: Spotify `https://open.spotify.com/oembed?url=`, YouTube `https://www.youtube.com/oembed?url=&format=json`.
  2. Поиск на Deezer `https://api.deezer.com/search?q=artist:"…" track:"…"`, затем `/track/{id}`, откуда берём `bpm`, `preview`, `release_date`.
  3. `previewUrl` = наш `/api/music/preview?id=…`.
  4. Таймаут каждого запроса 5 с. Любой сбой означает «нет данных», а не ошибку.
- [ ] **Спайк в первый час задачи:** проверить, что Deezer API отвечает с сервера Vercel и что mp3 превью проигрывается через прокси в `<audio>` с `crossOrigin="anonymous"`. Если нет, музыка для ссылок идёт только из `songGuess` и embed-плеера, и мы сообщаем B, что аудиореактивность будет только для файлов
- [ ] Коммит `feat(music): link parsing, deezer bpm and preview proxy`

### A6. Генерация: оркестрация `/generate`

**Files:**
- Create: `src/app/api/days/[dayId]/generate/route.ts`, `src/lib/generateDay.ts`
- Test: `src/lib/generateDay.test.ts`

**Interfaces:**
- `POST /api/days/[dayId]/generate` body `{ photoFeatures: PhotoFeatures[]; music: MusicFeatures | null }` → `DayRecord` (`status: 'ready'`)
- Consumes: `analyzeDay`, `resolveSong`, `mergeMusic`, `buildStyle` (от B), `validateTitle`, `slugify`
- Produces: `generateDay(dayId: string, body): Promise<DayRecord>`, зависимости передаются аргументом, чтобы тест мог их замокать

- [ ] `export const maxDuration = 60` в роуте
- [ ] Тест с моками: статус меняется `draft → generating → ready`; в `buildStyle` уходит `seed = hash(dayId)`; итоговая папка `days/{diary}/{date}-{slug}/`. Если slug совпадает с уже существующим в дневнике, добавляется `-2`
- [ ] Тест: если день уже `generating`, повторный вызов → 409; если `ready`, возвращаем как есть (идемпотентность)
- [ ] Лимит `GENERATE_LIMIT_PER_DAY` генераций на дневник в сутки (считаем по `days` за последние 24 часа) → 429 с текстом «Лимит на сегодня исчерпан»
- [ ] Шаги внутри:
  1. Скачать thumbs → base64.
  2. Если `song.kind === 'link'`, вызвать `resolveSong`.
  3. `analyzeDay`.
  4. `mergeMusic`.
  5. `buildStyle`.
  6. Название и slug.
  7. Переместить файлы из `_draft-…` в итоговую папку (`storage.move`).
  8. Записать `text.md`, `song.json`, `analysis.json`, `style.json`.
  9. Обновить строку.
  10. При исключении: `status='error'`, `error=<короткий текст>`.
- [ ] Ручная проверка end-to-end на прод-ссылке: **интеграция №1**
- [ ] Коммит `feat(generate): full day pipeline`

### A7. Озвучка

**Files:**
- Create: `src/lib/voice/pickVoice.ts`, `src/lib/voice/tts.ts`, `src/app/api/days/[dayId]/voice/route.ts`
- Test: `src/lib/voice/pickVoice.test.ts`

**Interfaces:**
- Produces: `pickVoice(analysis: DayAnalysis, music: MusicFeatures): VoicePreset`;
  `POST /api/days/[dayId]/voice` → `{ url, preset }` (кэш: если `voice.mp3` уже есть, просто отдаём ссылку). Если нет `OPENAI_API_KEY`, ответ `{ url: null, preset }`, и B озвучивает через Web Speech API с `rate = preset.speed`

- [ ] Правила голоса, системные, а не случайные:

  | Условие (проверяем сверху вниз) | voice | speed | instructions |
  |---|---|---|---|
  | `tension > 0.6` | `ash` | 1.1 | «Собранно, чуть быстрее, короткие паузы, без драматизма» |
  | `arousal > 0.6 && valence > 0.2` | `coral` | 1.08 | «Живо, с улыбкой в голосе» |
  | `valence < -0.2` | `sage` | 0.9 | «Тихо, медленно, с паузами, бережно» |
  | `nostalgia > 0.5` | `ballad` | 0.93 | «Тепло, как будто вспоминаешь вслух» |
  | иначе | `nova` | 1.0 | «Спокойно и тепло, как запись в дневнике» |

  Если `mode === 'minor'`, speed дополнительно −0.05. Поле `because` повторяет сработавшее условие человеческими словами.
- [ ] Тесты: каждая строка таблицы + проверка минора
- [ ] `tts.ts`: OpenAI `audio.speech.create({ model: 'gpt-4o-mini-tts', voice, input: text, instructions, response_format: 'mp3' })` с `speed` в теле запроса. Результат кладём в `voice.mp3` в папку дня. Текст длиннее 1500 символов обрезаем по последнему предложению
- [ ] Коммит `feat(voice): mood-based voice presets and tts`

### A8. Архив, лента, папка дня, ZIP

**Files:**
- Create: `src/app/page.tsx`, `src/app/diary/[diaryId]/page.tsx`, `src/components/ArchiveGrid.tsx`, `src/components/DayCard.tsx`, `src/components/FeedStrip.tsx`, `src/components/FolderPanel.tsx`, `src/lib/client/zipFolder.ts`

**Interfaces:**
- Produces для B: `<FolderPanel day={DayRecord} />`, панель «Папка дня», которую B вставляет на страницу дня;
  `downloadDayZip(day: DayRecord): Promise<void>` собирает ZIP «{title}.zip» из signed URLs через JSZip

- [ ] Лендинг:
  - заголовок и одна фраза о продукте;
  - кнопка «Мой дневник»: `getOrCreateDiaryId()` и переход в него;
  - кнопка «Демо-дневник» ведёт в `/diary/demo`.
- [ ] Архив:
  - сетка постеров 9:16 по месяцам («Ноябрь 2026»), на карточке дата и название;
  - поиск по названию и тексту (`?q=`, debounce 300 мс);
  - переключатель «Сетка / Лента». Лента: горизонтальная полоса 5–7 постеров подряд, крупно (это «проверка лентой» из ТЗ);
  - пустое состояние «Запишите первый день» со ссылкой на форму;
  - в демо-дневнике кнопки записи нет.
- [ ] FolderPanel: иконка папки с названием и список файлов (`text.md`, `photos/…`, `song.json` / `song.mp3`, `memory.png`, `voice.mp3`, `analysis.json`, `style.json`) с размерами. Кнопка «Скачать папку»
- [ ] Ручная проверка на телефоне (375px): сетка в 2 колонки, лента листается свайпом
- [ ] Коммит `feat(archive): diary grid, feed, day folder zip`

### A9. Деплой, сид демо-дневника, материалы для сдачи

**Files:**
- Create: `scripts/seed-demo.ts`, `README.md` (дополнить), `docs/submission/tools.md`, `docs/submission/description.md` (вместе с B)

- [ ] `scripts/seed-demo.ts`: для каждой папки `fixtures/demo/<slug>/` (`text.md`, `photos/*.jpg`, `song.json` = `SongRef`, `date.txt`) выполняет тот же путь, что и браузер (features считаем через `sharp` по той же формуле, что `computeFeatures`), в дневник `demo`. Запуск: `npx tsx scripts/seed-demo.ts`
- [ ] Постеры демо-дней: B открывает каждый день один раз, и постер загружается сам (или запускаем `?exportPoster=1`)
- [ ] README: что это; ссылка на прод; как запустить локально (`cp .env.example .env.local`, `npm i`, `npm run dev`); как устроена генерация (5 строк); где правила визуальной системы
- [ ] `tools.md`: Next.js, Supabase, Claude API (`claude-opus-5-5`: анализ текста и фото, названия), OpenAI TTS, Deezer API, oEmbed Spotify/YouTube, p5.js, Meyda, web-audio-beat-detector, heic2any, JSZip, шрифты Google Fonts. Плюс честная строка: какие части писали с помощью AI-ассистентов
- [ ] Финальная проверка по чек-листу сдачи из раздела 7 обзора
