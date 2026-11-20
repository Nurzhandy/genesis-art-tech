# Полка дневников и свободная страница — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Несколько дневников на «столе», украшения поверх страницы дня (стикеры, текст, кисть) в цветах палитры, авто-стикеры по записи.

**Architecture:** Дневник получает название и вид (миграция 0004), полка — список ключей в localStorage. Украшения — `days.decor` (JSON в координатах холста 1080×1920, цвет — ссылка на палитру), рисуются движком отдельным слоем, поэтому попадают в постер, обои, видео, книгу и подарок. Авто-стикеры — правило `autoDecor`, как остальные правила стиля, с причиной.

**Tech Stack:** Next.js 16 App Router, React 19.3, TypeScript, Supabase, Canvas 2D, Vitest, zod.

**Spec:** `docs/superpowers/specs/2026-11-20-shelf-and-free-page-design.md`

## Global Constraints

- Цвета украшений — только `ink | paper | a0 | a1 | a2` из `style.palette`; стикеры — свой набор Path2D, не эмодзи.
- Лимиты decor: до 40 элементов, штрих до 400 точек, сериализованный decor до 64 КБ.
- Вид дневника: `memories | travel | work | insights | custom`; название дневника до 60 символов.
- Запись во всех видах: текст + минимум 1 фото + песня (как сейчас).
- Без новых npm-зависимостей. `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` зелёные перед пушем.

## Review Focus

1. Старое устройство с одиночным ключом `atmosphere-diary-id` — после обновления его дневник есть на полке и он остаётся владельцем (тест в Task 1).
2. Decor от чужого или без ключа → 403; слишком большой decor или 41 элемент → 400 (тест в Task 3).
3. Старый день без `decor` и без `stamps` рисуется как раньше (тест в Task 3: `normalizeDecor(undefined)` → пустой список).
4. «Не совсем так?» после украшения: украшения остаются и перекрашиваются (цвет — ссылка; тест `resolveColor` в Task 3).
5. Авто-стикеры не ложатся на фото и подпись и не дублируют один и тот же стикер (тест в Task 5).

---

### Task 1: Полка дневников — данные, API, ключи

**Files:**
- Create: `supabase/migrations/0004_shelf_decor.sql`, `src/lib/shelf.ts`, `src/lib/shelf.test.ts`
- Modify: `src/lib/client/diaryKey.ts`, `src/lib/client/diaryId.ts`, `src/lib/client/api.ts`, `src/app/api/diaries/route.ts`, Create `src/app/api/diaries/[diaryId]/route.ts`, `src/lib/types.ts`

**Interfaces:**
- Produces: `type DiaryKind = 'memories'|'travel'|'work'|'insights'|'custom'`; `interface DiaryMeta { id; title: string; kind: DiaryKind; createdAt; dayCount: number; lastColor: string | null; lastPosterUrl?: string }`;
  `NewDiaryInput` (zod: `title` 1..60 trim, `kind`); `DIARY_KINDS: Record<DiaryKind, { label; icon; cover; prompt; defaultTitle }>`;
  клиент: `readShelf(): string[]`, `addToShelf(id)`, `removeFromShelf(id)`, `useShelf(): string[] | undefined`, `useIsMyDiary(id)` (по полке), `ownerHeaders(diaryId)`;
  API: `api.createDiary({title, kind})`, `api.shelf(ids)`, `api.renameDiary(id, title)`.
- [ ] Тест `shelf.test.ts`: `parseShelf('["a","b"]')` → `['a','b']`; битый JSON → `[]`; `migrateShelf(null, 'old')` → `['old']`; `migrateShelf('["x"]', 'old')` → `['x','old']` без дублей; `NewDiaryInput` режет пробелы и отклоняет 61 символ и неизвестный вид.
- [ ] Реализовать, миграцию применить к Supabase, `assertCanEdit` не меняется (ключ = id дневника).
- [ ] `GET /api/diaries?ids=` отдаёт только существующие, до 50 id; `PATCH /api/diaries/[id]` — `x-diary-key`.
- [ ] Коммит `feat(shelf): several diaries with title and kind`.

### Task 2: «Стол» на главной и дневник с названием

**Files:**
- Create: `src/components/shelf/Desk.tsx`, `src/components/shelf/NewDiaryDialog.tsx`, `src/components/shelf/DiaryCover.tsx`
- Modify: `src/app/page.tsx`, `src/components/Archive.tsx`, `src/app/diary/[diaryId]/page.tsx`, `src/components/DiaryKey.tsx`, `src/components/DayForm.tsx`, `src/components/BookView.tsx`

**Interfaces:** Consumes Task 1.
- [ ] Первый экран: обложки дневников полки (`DiaryCover`: цвет вида или цвет последнего дня, иконка, название, число дней), слот «+ новый дневник» (диалог: название + вид), демо-дневник примером. Пустая полка — только слот и пример. Импорт `/?shelf=a,b` с подтверждением.
- [ ] Архив: заголовок = название дневника (владелец может переименовать), вид — подсказка в форме записи (`DIARY_KINDS[kind].prompt`), обложка книги — цвет вида.
- [ ] Проверить в браузере, коммит `feat(shelf): desk on the home page`.

### Task 3: Модель украшений, стикеры, рендер, сохранение

**Files:**
- Create: `src/lib/decor/types.ts`, `src/lib/decor/decor.ts`, `src/lib/decor/decor.test.ts`, `src/render/stickers.ts`, `src/render/decor.ts`, `src/app/api/days/[dayId]/decor/route.ts`
- Modify: `src/lib/types.ts` (`DayRecord.decor?`), `src/lib/db.ts`, `src/render/engine.ts`, `src/render/types.ts` (`DayInfo.decor?`), `src/components/MemoryPlayer.tsx`, `src/render/exportDay.ts`, `src/components/BookView.tsx`, `src/lib/client/api.ts`, `src/lib/client/zipFolder.ts`

**Interfaces:**
- Produces: `type DecorColor = 'ink'|'paper'|'a0'|'a1'|'a2'`;
  `type DecorItem = { id: string; kind: 'sticker'; shape: StickerShape; x; y; scale; rot; color } | { id; kind: 'text'; text: string; x; y; size; rot; color } | { id; kind: 'stroke'; points: number[]; width: 2|5|10; color }`;
  `interface Decor { v: 1; source: 'auto'|'user'; items: DecorItem[] }`; `DecorSchema` (zod, лимиты из Global Constraints);
  `normalizeDecor(raw: unknown): Decor`; `resolveColor(c: DecorColor, palette): string`;
  `STICKER_SHAPES` (16: tape, star, heart, leaf, snowflake, sun, flower, drop, cloud, cup, note, ticket, arrow, sparkle, stamp, wave), `drawSticker(g, shape, size, color)`;
  `drawDecor(g, decor, palette, fonts, alpha)`; `api.saveDecor(dayId, decor)`.
- [ ] Тесты: `normalizeDecor(undefined)` → `{v:1, source:'auto', items:[]}`; 41 элемент → ошибка схемы; штрих 401 точка → ошибка; `resolveColor('a1', palette)` = `palette.accents[1]`, `a2` при двух акцентах → `accents[0]`; текст длиннее 80 обрезается схемой (ошибка).
- [ ] `PUT /api/days/[id]/decor`: `assertCanEdit`, не капсула, статус ready, тело ≤ 64 КБ, сохраняет `decor`, `decor.json` в папку, `poster_path: null`.
- [ ] Движок рисует decor после подписи/заметок, до зерна, с альфой подписи из сборки; `noText` обоев decor оставляет только стикеры и кисть.
- [ ] Коммит `feat(decor): stickers, text and brush layer in the renderer`.

### Task 4: Редактор страницы

**Files:**
- Create: `src/components/decor/DecorEditor.tsx`, `src/components/decor/StickerIcon.tsx`
- Modify: `src/components/DayView.tsx`, `src/components/MemoryPlayer.tsx`

**Interfaces:** Consumes Task 3 (`Decor`, `DecorItem`, `drawSticker`, `api.saveDecor`).
- [ ] Кнопка «✎ Украсить страницу» (владелец). Режим: холст постерного кадра + слой SVG/DOM с элементами в координатах 1080×1920 (масштаб к ширине). Панель: стикеры (16), «Текст», «Кисть» (3 толщины), 5 цветов палитры, «Отменить», «Очистить», «Сохранить», «Отмена».
- [ ] Перетаскивание pointer-событиями, ручка поворота/размера у выбранного, удаление клавишей Delete и кнопкой.
- [ ] После сохранения день перезагружается, постер пересоздаётся плеером.
- [ ] Проверить в браузере (мышь и тач-эмуляция), коммит `feat(decor): page editor`.

### Task 5: Авто-стикеры и «Наговорить день»

**Files:**
- Create: `src/lib/decor/autoDecor.ts`, `src/lib/decor/autoDecor.test.ts`
- Modify: `src/lib/generateDay.ts` (+test), `src/lib/style/buildStyle.ts` (причина `decor`), `src/components/WhyPanel.tsx`, `src/components/DayForm.tsx`, `src/components/DayTextInput.tsx`

**Interfaces:**
- Produces: `autoDecor(analysis: DayAnalysis, text: string, seed: number): { decor: Decor; because: string }`.
- [ ] Тесты: «пили какао», осень → есть `cup` и `leaf`, причина содержит «какао»; ночь → `star`; дождь → `drop`; не больше 4, без повторов формы; все точки вне фото-зоны и зоны подписи (`LAYOUT`); одинаковый seed → одинаковый результат.
- [ ] `generateDay` пишет `decor` (source auto), `restyle` его не трогает; причина «Стикеры: …» в reasons (`param: 'decor'`), подпись «Стикеры» в WhyPanel.
- [ ] Форма: кнопка «🎙 Наговорить день» первой, крупно.
- [ ] Коммит `feat(decor): auto stickers from the entry`.

### Task 6: Проверка и сдача

- [ ] Полный прогон проверок, сценарий в браузере: новый дневник «Путешествия» → день → украсить → постер/обои с украшениями → архив → книга.
- [ ] Обновить `docs/submission/description.md` (полка, свободная страница) и план; пуш. Деплой — по согласию.
