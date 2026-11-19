# Часть B: визуальная система, рендер, просмотр дня

> Общий контекст, контракты и таймлайн: [00-overview.md](00-overview.md). Все типы берём из
> `src/lib/types.ts`.

**Зона ответственности B:** всё, что превращает день в картинку и звук, то есть 55 из 100
баллов (атмосфера 30 и визуальная система 25). Сюда входят движок правил `buildStyle`,
рендер на p5.js, пять техник, лаборатория `/lab`, проверка лентой, страница просмотра дня,
постер, панель «Почему так», а также тексты про художественные приёмы для сдачи.

**Что B отдаёт A:** `buildStyle(input: StyleInput): StyleParams` из `@/lib/style/buildStyle`
и **в первый час** заглушку `fixtures/style-stub.json` + `buildStyleStub()`;
`exportPoster(canvas: HTMLCanvasElement): Promise<Blob>`.

**Что B берёт у A:** `DayRecord` через `api.getDay(dayId)`, `<FolderPanel day />`,
`api.requestUploads(dayId, [{ kind: 'poster', ext: 'png' }])`, `api.voice(dayId)`.
Пока API нет, работаем на фикстурах: `/lab` от A не зависит.

**Порядок:** B0 → B1 → B2 → B3 → B4 → B5 (к интеграции №1 вечером 20-го: B1, B2 и хотя бы
одна техника) → B6 → B7 → B8 → B9.

**Главный принцип:** никакого `Math.random()`. Только `p.randomSeed(style.seed)` и
`p.noiseSeed(style.seed)`, чтобы день при каждом открытии выглядел так же, как на постере.

---

### B0. Фикстуры и заглушка (вечер 19 ноября, ~1 час)

**Files:**
- Create: `fixtures/days/autumn-park.json`, `office-night.json`, `rainy-alone.json`, `summer-friends.json`, `grandma-old-song.json`, `neutral.json`, `fixtures/style-stub.json`, `src/lib/style/buildStyleStub.ts`

- [ ] Каждая фикстура: `{ input: StyleInput, photos: string[] /* пути в public/fixtures/ */ }`. Значения подбираем руками по примерам из ТЗ:
  - `autumn-park`: valence 0.6, arousal 0.25, autumn, nature, pair, тёплые фото, Sinatra bpm 76, major, jazz, 1957;
  - `office-night`: valence −0.2, arousal 0.75, tension 0.85, night, indoor, alone, холодные фото, electronic bpm 128, minor;
  - `rainy-alone`: valence −0.4, arousal 0.15, city, alone, ambient bpm 70, minor;
  - `summer-friends`: valence 0.8, arousal 0.8, group, 5 фото, pop bpm 118, major;
  - `grandma-old-song`: valence 0.4, nostalgia 0.85, indoor, pair, песня 1975 года;
  - `neutral`: все шкалы по 0.5 и 0, одно серое фото, `songGuess: null`, music по умолчанию.
- [ ] Фото для фикстур берём свои (по 1–5 на день) и кладём в `public/fixtures/<день>/`
- [ ] Коммит `chore(fixtures): style inputs for lab and tests`

### B1. Движок правил `buildStyle`: ядро объяснимой логики

**Files:**
- Create: `src/lib/style/constants.ts`, `src/lib/style/techniques.ts`, `src/lib/style/palette.ts`, `src/lib/style/motion.ts`, `src/lib/style/buildStyle.ts`, `src/lib/style/color.ts` (hex ↔ OKLCH)
- Test: `src/lib/style/buildStyle.test.ts`, `src/lib/style/palette.test.ts`

**Interfaces:**
- Produces: `buildStyle(input: StyleInput): StyleParams`;
  `scoreTechniques(input: StyleInput): Record<Technique, number>`;
  `buildPalette(input: StyleInput): StyleParams['palette']`;
  `buildMotion(input: StyleInput, photoCount: number): Pick<StyleParams, 'motion' | 'durationSec'>`;
  `LAYOUT` (постоянные элементы: поля, зоны сетки, размеры шрифтов) из `constants.ts`

- [ ] Тесты на фикстурах (сначала пишем, проверяем, что падают):
  ```ts
  const s = (name) => buildStyle(load(name).input)
  expect(s('autumn-park').techniques.primary).toBe('impressionist')
  expect(s('office-night').techniques.primary).toBe('geometric')
  expect(s('office-night').motion.beatsPerPhoto).toBe(2)
  expect(s('office-night').motion.easing).toBe('sharp')
  expect(s('rainy-alone').techniques.primary).toBe('minimal')
  expect(s('rainy-alone').composition.negativeSpace).toBeGreaterThan(0.6)
  expect(s('grandma-old-song').techniques.primary).toBe('film')
  expect(s('grandma-old-song').texture.grain).toBeGreaterThan(0.5)
  expect(s('summer-friends').techniques.primary).toBe('collage')
  expect(s('neutral').durationSec).toBeGreaterThanOrEqual(20)        // нейтральный день тоже валиден
  expect(warmthOf(s('autumn-park').palette.accents)).toBeGreaterThan(warmthOf(s('office-night').palette.accents))
  // детерминизм
  expect(s('autumn-park')).toEqual(s('autumn-park'))
  // объяснимость: у каждого ключевого решения есть причина
  for (const p of ['technique', 'palette', 'motion', 'negativeSpace', 'grain'])
    expect(s('autumn-park').reasons.some(r => r.param === p)).toBe(true)
  ```
- [ ] Скоринг техник (`techniques.ts`), стартовые веса. Дальше тюним в `/lab`, но тесты выше должны оставаться зелёными:
  ```
  v+ = max(valence, 0), v- = max(-valence, 0)
  impressionist = 0.45·(1−arousal) + 0.30·v+ + 0.15·[setting ∈ nature,water] + 0.10·[light warm]  + 0.15·[genre ∈ jazz,classical,swing,folk]
  geometric     = 0.35·arousal + 0.40·tension + 0.15·[timeOfDay=night или setting ∈ city,indoor] + 0.20·[genre ∈ electronic,techno,house,drum]
  minimal       = 0.40·(1−arousal) + 0.30·v- + 0.20·[people=alone] + 0.15·[genre ∈ ambient,lofi,classical] + 0.10·[mode=minor]
  film          = 0.55·nostalgia + 0.30·[year < 2000] + 0.10·[people ∈ pair,group] + 0.05·[light warm]
  collage       = 0.30·arousal + 0.30·v+ + 0.20·[photos ≥ 3] + 0.20·[people=group] + 0.15·[genre ∈ pop,hiphop,rock,indie]
  primary = argmax; secondary = второй, если score ≥ 0.7·primary, иначе null; mix = 0.35·(score2/score1)
  ```
- [ ] Палитра (`palette.ts`) в OKLCH:
  1. Объединить палитры всех фото, взвешенные по доле, и взять 6 опорных цветов.
  2. Сдвиг тона: тепло (к 60°) на `0.25·v+ + 0.15·[light warm]`, холод (к 250°) на `0.3·tension + 0.2·[night]`.
  3. Насыщенность (chroma) ×`(0.55 + 0.45·arousal)`; при миноре ещё ×0.75.
  4. Сезонная подмешка 15%: осень охра `#C8892B`, зима сине-серый `#7C8DA6`, весна `#E8B4C0`, лето `#F2C14E`.
  5. `bg` = самый светлый цвет после сдвига при valence ≥ 0, самый тёмный при tension > 0.6 или night; `paper` = bg ±4% L; `ink` = максимальный контраст к bg (≥ 4.5:1).
  - Тест: контраст `ink` к `bg` ≥ 4.5 на всех фикстурах.
- [ ] Ритм (`motion.ts`):
  - `beatsPerPhoto` = 2 при arousal > 0.6, 4 при arousal > 0.3, иначе 8;
  - интервал кадра = `beatsPerPhoto · 60 / bpm` с;
  - `durationSec` = clamp(интервал · кол-во фото · 2 круга, 20, 45);
  - `easing` = sharp, если tension > 0.5;
  - `jitter` = 0.1 + 0.6·energy.
- [ ] Остальное:
  - `negativeSpace` = clamp(0.2 + 0.5·(1−arousal) + 0.1·[minor]);
  - `density` = 1 − negativeSpace;
  - `grain` = clamp(0.12 + 0.5·nostalgia + 0.2·[year < 1990]);
  - `brush` = вес impressionist;
  - `photoFrame`: impressionist → soft, geometric → hard, collage → torn, minimal → none, film → hard;
  - `titleWeight`: 700 при tension > 0.6, 400 при arousal < 0.3, иначе 600;
  - `captionTilt` = (seed % 13 − 6) · (0.3 + arousal).
- [ ] `reasons`: по-человечески, с цифрами. Например: «Медленная мажорная песня (76 BPM) → кадр держится 8 долей ≈ 6 с», «Ночь и дедлайн (напряжение 0.85) → холодный сдвиг палитры и жёсткая сетка Кандинского», «Песня 1957 года → плёночное зерно 0.6»
- [ ] `npm test -- style` → PASS. Коммит `feat(style): explainable rule engine`

### B2. Каркас рендера и постоянные элементы

**Files:**
- Create: `src/render/MemoryCanvas.tsx`, `src/render/sketch.ts`, `src/render/layout.ts`, `src/render/timeline.ts`, `src/render/photos.ts`, `src/render/fx/grain.frag`, `src/render/fx/post.ts`, `src/app/lab/page.tsx`

**Interfaces:**
- Produces: `<MemoryCanvas style={StyleParams} photos={string[]} title caption date dayNumber audio?={HTMLAudioElement} playing={boolean} onReady?={(canvas) => void} />` (подключается через `dynamic(() => import(...), { ssr: false })`);
  `Technique` модуль: `interface TechniqueRenderer { setup(ctx: RenderCtx): void; drawPhoto(ctx: RenderCtx, photo: p5.Image, t: PhotoTime): void; drawOverlay(ctx: RenderCtx, t: number): void }`;
  `RenderCtx = { p: p5; style: StyleParams; layout: typeof LAYOUT; pg: p5.Graphics /*1080×1920*/; energy: () => number }`;
  `PhotoTime = { index: number; local: number /*0..1 внутри кадра*/; transition: number /*0..1 смена кадра*/ }`

- [ ] Холст: offscreen `p5.Graphics` 1080×1920, на экран выводится вписанным по высоте окна (CSS `aspect-ratio: 9/16`). При слабом устройстве (`devicePixelRatio > 2` и ширина < 500) рендерим в 540×960
- [ ] Порядок слоёв, **одинаковый для всех техник:**
  1. бумага (`palette.paper` + шум по `texture.paper`);
  2. фото-зона (техника рисует её через `drawPhoto`);
  3. оверлей техники;
  4. постоянные элементы: дата и номер дня, название, подпись;
  5. пост-обработка через шейдер (зерно `texture.grain`, лёгкая виньетка).
- [ ] `timeline.ts`: из `style.motion` и числа фото считаем `PhotoTime` на момент t; переход занимает 1 долю (`easing` soft = easeInOutSine, sharp = почти ступенька)
- [ ] `/lab`:
  - выбор фикстуры;
  - холст;
  - справа все поля `StyleParams` ползунками, их можно перекрыть руками;
  - отдельный выбор техники;
  - кнопка «Сбросить к правилам»;
  - внизу панель `reasons`.

  Это наш инструмент тюнинга, и его же можно показать в видео как «вот система».
- [ ] Ручная проверка: на `/lab` для 6 фикстур видна одинаковая рамка (дата, название, подпись на своих местах), но разные палитры
- [ ] Коммит `feat(render): canvas scaffold, constant layout, lab`

### B3. Техника «Импрессионизм» (Моне)

**Files:** Create `src/render/techniques/impressionist.ts`

- [ ] Painterly rendering по фото:
  - для каждого кадра заранее генерируем N мазков, `N = 6000·(0.6 + density)`, на сетке с jitter от seed;
  - цвет мазка: пиксель фото, перемапленный к ближайшему цвету палитры на 40% (палитра «просвечивает»);
  - направление по градиенту яркости (перпендикулярно), длина `8 + 30·brush·(1 − energy·0.4)` px, толщина 3–7 px, alpha 0.6–0.9;
  - мазки появляются волной за первые 30% кадра, затем медленно «дышат» (сдвиг шумом по `jitter`);
  - смена кадра: мазки нового фото ложатся поверх старого, без жёсткого cut.
- [ ] Оверлей: мягкие световые пятна (radial gradients цвета `accents[0]`, blend `SCREEN`, 3–5 шт.)
- [ ] Производительность: мазки предрасчитаны в массивы, на кадр не больше 2000 рисований, держим ≥ 30 fps на ноутбуке
- [ ] Проверка на фикстуре `autumn-park`: глядя на кадр, должно хотеться сказать «тёплый осенний день». Если нет, крутим в `/lab`
- [ ] Коммит `feat(render): impressionist technique`

### B4. Техника «Геометрия» (Кандинский)

**Files:** Create `src/render/techniques/geometric.ts`

- [ ] Фото в жёстких прямоугольных окнах по сетке 6×10, постеризация до палитры (4–5 уровней), кадры меняются **резко, точно в долю**
- [ ] Оверлей:
  - круги, полукруги, прямые и дуги, шахматный фрагмент;
  - количество `8 + 24·density`;
  - цвета из `accents` плюс чистый `ink`;
  - композиция по диагонали, от seed;
  - на каждую долю одна фигура «вспыхивает» (scale 1 → 1.08 → 1) с силой `jitter`.
- [ ] Свои фигуры, **не копия конкретной картины** (ТЗ, раздел 12)
- [ ] Проверка на `office-night`: «холодно, собранно, ритмично»
- [ ] Коммит `feat(render): geometric technique`

### B5. Страница дня: плеер, звук, автоплей, «Почему так»

**Files:**
- Create: `src/app/day/[dayId]/page.tsx`, `src/components/MemoryPlayer.tsx`, `src/components/WhyPanel.tsx`, `src/components/VoiceButton.tsx`, `src/render/audioReactive.ts`

**Interfaces:**
- Consumes: `api.getDay`, `<FolderPanel day />` (A), `api.voice` (A)
- Produces: `createEnergyMeter(audio: HTMLAudioElement): () => number` (0..1, сглаженный RMS через `AnalyserNode`)

- [ ] Экран до старта: постер дня, название, дата и большая кнопка **«▶ Открыть день»**. Клик запускает и аудио, и анимацию (обход автоплея, раздел 8 обзора, п. 5)
- [ ] Звук:
  - есть `day.songUrl` (свой файл или прокси превью Deezer): свой `<audio src={day.songUrl} crossOrigin="anonymous">` + `createEnergyMeter`, анимация пульсирует от громкости;
  - иначе embed Spotify/YouTube (iframe под холстом). Пользователь сам нажимает в нём play, а анимация идёт по BPM из `style.motion`.
- [ ] После завершения цикла анимация мягко повторяется. Музыка продолжает играть
- [ ] `VoiceButton` («Послушать запись»): вызывает `api.voice`, если `url` есть, играет mp3, если `url: null`, озвучивает через `speechSynthesis` (ru-RU, `rate = preset.speed`). Подпись: «Голос подобран под настроение: {preset.because}»
- [ ] `WhyPanel` («Почему этот день выглядит так»): техника и её доля, палитра кружками, затем 5–8 строк из `style.reasons`
- [ ] Внизу `<FolderPanel day />` от A
- [ ] Если `status === 'generating'`, показываем экран прогресса со строками «Читаю запись… Слушаю песню… Подбираю палитру… Пишу название…» (опрос `getDay` раз в 2 с). Если `error`, показываем текст ошибки и кнопку «Повторить»
- [ ] Ручная проверка в Chrome и Safari iOS: звук стартует по кнопке, без кнопки ничего не играет
- [ ] Коммит `feat(day): memory player page`

### B6. Техники «Минимализм» и «Плёнка»

**Files:** Create `src/render/techniques/minimal.ts`, `src/render/techniques/film.ts`

- [ ] **Минимализм (ма):**
  - одно фото за раз, маленькое окно (`1 − negativeSpace` от ширины), смещено по золотому сечению;
  - остальное пустая бумага, одна тонкая линия горизонта;
  - маленький красный квадрат-акцент в цвете `accents[0]` (как печать);
  - смена кадра: медленный fade через бумагу;
  - движения почти нет.

  Проверка на `rainy-alone`.
- [ ] **Плёнка:**
  - кадр в рамке плёнки (перфорация по краю, номер кадра мелким моно);
  - тёплый сдвиг теней, halation вокруг светлых зон;
  - засветки (light leaks) раз в 2–3 кадра;
  - лёгкое дрожание кадра (gate weave) `jitter·2px`;
  - зерно шейдером по `texture.grain`.

  Проверка на `grandma-old-song`.
- [ ] Коммит `feat(render): minimal and film techniques`

### B7. Техника «Коллаж» и смешивание техник

**Files:** Create `src/render/techniques/collage.ts`, `src/render/blend.ts`

- [ ] **Коллаж:**
  - 2–4 фото одновременно, вырезаны маской с рваным краем (шум по контуру);
  - поворот ±8°, тень, кусочки скотча;
  - вырезки цветной бумаги из `accents`;
  - фото «прилетают» в долю.

  Проверка на `summer-friends`.
- [ ] **Смешивание (`blend.ts`):** `primary` рисует фото-зону, `secondary` (если есть) добавляет только свой `drawOverlay` с непрозрачностью `mix`. Пример: тёплый вечер с ностальгией = мазки Моне и плёночное зерно с засветками поверх
- [ ] Проверка: в `/lab` вручную задать пары (impressionist+film, geometric+collage, minimal+film), и каждая смотрится цельно
- [ ] Коммит `feat(render): collage technique and blending`

### B8. Постер, проверка лентой, тюнинг

**Files:** Create `src/render/poster.ts`, `src/app/lab/feed/page.tsx`

**Interfaces:**
- Produces: `exportPoster(canvas: HTMLCanvasElement): Promise<Blob>` (PNG 1080×1920, кадр в момент t = 40% первого фото, когда мазки и фигуры уже проявились)

- [ ] На странице дня: если `posterPath` пуст, после первого полного кадра делаем `exportPoster`, затем `api.requestUploads(kind: 'poster')` и upload. Тот же код срабатывает при `?exportPoster=1` для сида демо
- [ ] `/lab/feed`: все фикстуры (а после сида и реальные демо-дни) рядом, 5–7 штук, в живой анимации. Чек-лист «проверки лентой» из ТЗ:
  - [ ] сразу видно, что это один дневник (рамка, шрифты, бумага, место даты и подписи);
  - [ ] каждый день узнаваемо свой (не два одинаковых по технике и палитре рядом);
  - [ ] нет «грустно — значит синий»: у каждого дня читаются минимум 3 причины в WhyPanel;
  - [ ] свой любимый день каждого из команды «похож на то, как это ощущалось» (совет из ТЗ, раздел 8).
- [ ] По итогам правим веса в `techniques.ts`, `palette.ts`, `motion.ts`. Тесты B1 должны остаться зелёными (если правило меняется осознанно, обновляем и тест)
- [ ] Коммит `feat(render): poster export, feed check, tuning`

### B9. Материалы для сдачи (вечер 21 и день 22 ноября)

**Files:** Create `docs/submission/techniques.md`, `docs/submission/examples/` (PNG и MP4 демо-дней), `docs/submission/video-script.md`; соавтор `docs/submission/description.md`

- [ ] `techniques.md`: таблица из раздела 5 обзора, расширенная до «техника → когда включается (формула словами) → почему передаёт ощущение → какие параметры меняет». Отдельно: как музыка влияет на форму (BPM, энергия, лад, год, жанр)
- [ ] `examples/`: 5–7 демо-дней, у каждого PNG-постер и запись экрана 15–30 с со звуком; имя файла = название папки дня
- [ ] `description.md` (≤ 1 страницы, вместе с A): идея, аудитория, правила визуальной системы, как текст, фото и музыка влияют на результат
- [ ] `video-script.md` и запись видео ≤ 3 минут:
  - 0:00–0:20: проблема («фото помнят, как выглядел день, но не как он ощущался»);
  - 0:20–1:20: живой ввод любимого дня (текст, фото, песня) → прогресс → открытие воспоминания со звуком;
  - 1:20–1:50: «Почему так»: как песня и текст изменили картинку;
  - 1:50–2:30: папка дня с названием и архив в режиме «Лента», 5–7 разных дней одного дневника;
  - 2:30–2:50: `/lab`, где одна и та же фотография меняет технику вслед за настроением;
  - 2:50–3:00: финальная фраза.
- [ ] Необязательно, если останется время: экспорт воспоминания в WebM (`canvas.captureStream(30)` + `MediaRecorder`, звук только для своего файла и превью)

### B10. Доработки по ресерчу пользователей

Зачем и откуда: [docs/research/user-needs.md](../research/user-needs.md). Всё ниже P0, кроме
R10 и R15. Это самые дешёвые баллы за атмосферу, поэтому делаем до тюнинга ленты в B8.

- [x] **R4 (в B5):** ритуал открытия. Экран «▶ Открыть день» залит `palette.bg`, по клику кадр проявляется за 1,5 с (opacity и лёгкий blur → 0), музыка стартует с fade-in 2 с. Во время озвучки громкость музыки 0.25, после окончания плавно возвращается
- [x] **R2 (после B2):** заметки на полях. `analysis.sensory` (2–4 фрагмента) рукописным Caveat в зоне полей `LAYOUT.margin`, по одному на каждой смене кадра, проявление за 1 долю. Место по seed, но всегда в пределах полей. Цвет `ink`, наклон `captionTilt ± 2°`. На постере видны все
- [x] **R3 (после B3):** атмосферный слой, слой 3.5 между оверлеем и текстом:
  - правило в `buildStyle` → `atmosphere.kind` (проверяем сверху вниз): слова «дождь / ливень / морось» в `sensory` или тексте → `rain`; «снег» или winter → `snow`; autumn и nature → `leaves`; «пар / какао / чай / кофе / туман» → `mist`; night и city → `lights`; morning или day с тёплым светом → `dust`; иначе `none`;
  - `amount` = 0.3 + 0.5·energy; скорость падения ∝ bpm; при `easing: 'sharp'` частицы дёргаются в долю;
  - причина в `reasons`, например «В записи "дождь" → капли по стеклу, плотность 0.6 от энергии песни»;
  - не больше 300 частиц, всё через `p.random` с seed;
  - тест в `buildStyle.test.ts`: `autumn-park` → `leaves`, `office-night` → `lights`, `rainy-alone` → `rain`, `neutral` → `none`
- [x] **R5 (в /lab):** режим «Те же фото, другая песня»: два холста рядом, у правого селектор песни (наборы `MusicFeatures`: Sinatra 76 bpm major 1957 / techno 128 bpm minor / ambient 70 bpm minor / pop 118 bpm major). Под каждым холстом его `reasons`. Это кадр для видео
- [x] **R10 (P1, вместе с A):** *(часть B готова: правило в `buildStyle`, ползунки, живое превью, `api.restyle`; сохранение ждёт эндпоинт A)* на странице дня «Не совсем так?» → два ползунка «холоднее ↔ теплее», «спокойнее ↔ живее», превью сразу в браузере через `buildStyle`, «Сохранить» вызывает `api.restyle`. В «Почему так» строка «Вы сделали день теплее на 0.2»
- [ ] **R15 (P2):** это существующий пункт про WebM в B9
- [x] Коммиты: `feat(render): margin notes`, `feat(render): atmosphere layer`, `feat(day): opening ritual`, `feat(lab): same photos, different song`
