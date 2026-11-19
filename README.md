# Дневник атмосферы

Проект команды для **Genesis Hackathon // ArtTech**: *Make the Invisible Visible*.

Личный веб-дневник. Человек пишет, как прошёл день, прикладывает фото и песню, а система
собирает из этого анимированную страницу дневника под музыку. Палитра, фактура, ритм и
художественная техника подбираются под настроение дня. Каждый день попадает в папку с
придуманным названием, а все дни складываются в архив-ленту.

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

1. Форма: текст, 1–5 фото, песня (ссылка или файл). Браузер считает цвета фото и темп/энергию файла.
2. `POST /api/days/:id/generate`: Gemini читает день → `DayAnalysis`; Deezer даёт BPM; движок правил
   `src/lib/style/buildStyle.ts` → `StyleParams` с причинами; файлы переезжают в папку `дата-название`.
3. Страница дня рисует воспоминание на Canvas (`src/render/`) под песню, сохраняет постер, озвучивает запись.
4. Архив `/diary/:id` (сетка и лента), лаборатория стиля `/lab`, проверка лентой `/lab/feed`.

Тесты: `npm test`. Демо-дни: `fixtures/demo/README.md`. Материалы для сдачи: `docs/submission/`.

## Стек

Next.js + TypeScript, Supabase, Gemini API, Canvas 2D (свой движок рендера вместо p5.js), Vercel. Подробности в обзоре плана.
