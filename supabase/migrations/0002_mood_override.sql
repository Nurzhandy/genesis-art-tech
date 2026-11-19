-- «Не совсем так?»: поправка настроения от человека поверх анализа (docs/plan/part-A-backend-input.md, A10 / R10)
-- { "warmth": -0.4..0.4, "energy": -0.4..0.4 } или null, если стиль такой, как решила система.
alter table days add column if not exists mood_override jsonb;
