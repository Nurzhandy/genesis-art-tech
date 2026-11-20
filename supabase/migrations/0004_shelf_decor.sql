-- Полка дневников и свободная страница (docs/superpowers/specs/2026-11-20-shelf-and-free-page-design.md).
-- title, kind — название и вид дневника (memories | travel | work | insights | custom);
-- decor — украшения страницы дня { v: 1, source: 'auto' | 'user', items: [...] } в координатах холста 1080×1920.
alter table diaries add column if not exists title text;
alter table diaries add column if not exists kind text not null default 'memories'
  check (kind in ('memories', 'travel', 'work', 'insights', 'custom'));
alter table days add column if not exists decor jsonb;
update diaries set title = 'Демо-дневник' where id = 'demo' and title is null;
