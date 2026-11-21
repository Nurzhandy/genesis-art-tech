-- Трекер эмоций: чувство, которое человек отметил сам (слово из src/lib/feelings.ts)
alter table days add column if not exists feeling text;
