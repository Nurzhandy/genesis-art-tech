-- Свободная доска дневника (новая концепция 20.11): { v: 1, items: [...] }
alter table diaries add column if not exists board jsonb;
