-- День как пустая доска (план 21.11): своя доска у каждого дня. null — доски нет (старые дни из формы).
alter table days add column if not exists board jsonb;
