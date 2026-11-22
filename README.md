# Дневник атмосферы

Проект команды для **Genesis Hackathon // ArtTech**: *Make the Invisible Visible*.

Личный веб-дневник. Человек пишет, как прошёл день, прикладывает фото и песню, а система
собирает из этого анимированную страницу дневника под музыку. Палитра, фактура, ритм и
художественная техника подбираются под настроение дня. Каждый день попадает в папку с
придуманным названием, а все дни складываются в архив-ленту.

## Как проверить

Сайт: https://genesis-art-tech.vercel.app, без регистрации. Коротко: «Демо» → любой день → «Оживить день»
(звук!) → «Войти в день» → «Как собран этот день» → «Доска этого дня»; в архиве — вид «коридор». Подробная инструкция для жюри — [docs/submission/jury-guide.md](docs/submission/jury-guide.md),
7 примеров дней с названиями папок — [docs/submission/examples.md](docs/submission/examples.md).

## Материалы для сдачи

[Описание](docs/submission/description.md) · [Все функции](docs/submission/features.md) · [Художественные приёмы](docs/submission/techniques.md) ·
[Инструменты](docs/submission/tools.md) · [Примеры дней](docs/submission/examples.md) · [Сценарий видео](docs/submission/video-script.md)

## План

- [Обзор: архитектура, контракты, таймлайн](docs/plan/00-overview.md)
- [Часть A: бэкенд, AI, ввод дня, архив](docs/plan/part-A-backend-input.md)
- [Часть B: визуальная система, рендер, просмотр дня](docs/plan/part-B-visual-system.md)
- [Ресерч: потребности пользователей → баллы](docs/research/user-needs.md)
- [ТЗ хакатона (PDF)](docs/spec/genesis-art-tech-tz.pdf)

**Дедлайн:** 22 ноября 2026, 23:59 по Астане.

## Инфраструктура

- Прод: https://genesis-art-tech.vercel.app (Vercel, проект `nurzhandys-projects/genesis-art-tech`, функции в `fra1`)
- Supabase: проект `genesis-art-tech`, `https://gwpsfbqetmjboplljuzr.supabase.co` (eu-central-1), схема в `supabase/migrations/`
- Локально: `cp .env.example .env.local`, заполнить ключи, `npm i`, `npm run dev`. Ключи спросить у Нуржанды, в git их не коммитить.

## Как устроено

1. **Запись дня** — свободная доска дня: заметки, фото, песни, голосовые, капля настроения, рисунок и стикеры
   («Собрать день»); есть простая форма и «Рассказать день» голосом. Браузер считает цвета фото и темп/энергию файла.
2. **Сборка** (`/api/days/:id/assemble` → `generate`): Gemini читает день → `DayAnalysis` (название папки, подпись,
   детали — из записи); Deezer даёт BPM, год и превью; Open-Meteo — погоду того дня; движок правил
   `src/lib/style/buildStyle.ts` → `StyleParams` с причиной каждого решения; файлы переезжают в папку `дата-название`.
3. **Страница дня** рисует воспоминание на Canvas (`src/render/`) под песню, сохраняет постер, озвучивает запись
   (Gemini TTS, голос по правилам), раскладывает постер на слои («Как собран этот день») и показывает день изнутри в 3D («Войти в день»). «Не совсем так?» —
   поправка настроения тем же движком, без нового вызова AI.
4. **Архив** `/diary/:id`: доска дневника, сетка, коридор (3D-прогулка по дням с их песнями), книга, лента, календарь, «год в цветах», «В этот день».
   Вход по почте нужен только для дневников на нескольких устройствах. Лаборатория стиля `/lab`, проверка лентой `/lab/feed`.

Миграции из `supabase/migrations/` применяются по порядку в SQL Editor Supabase.

Тесты: `npm test`. Демо-дни: `fixtures/demo/README.md`. Материалы для сдачи: `docs/submission/`.

## Стек

Next.js + TypeScript, Supabase (Postgres, Storage, Auth), Gemini API (анализ и озвучка), Canvas 2D (свой движок рендера), GSAP, Lenis, Vercel. Полный список — [docs/submission/tools.md](docs/submission/tools.md).
