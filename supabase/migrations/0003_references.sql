-- План 20.11 (docs/plan/2026-11-20-references-ideas.md), часть A.
-- place        — город, который ввёл человек (A1), по нему считаем погоду;
-- weather      — погода того дня { tempC, precipitationMm, snowfallCm, cloudCover, place } (A1);
-- sealed_until — капсула времени: до этой даты день отдаёт только дату и название (A5);
-- share_id     — ссылка-подарок /s/<share_id>, null = не поделились (A4).
alter table days add column if not exists place text;
alter table days add column if not exists weather jsonb;
alter table days add column if not exists sealed_until date;
alter table days add column if not exists share_id text unique;
