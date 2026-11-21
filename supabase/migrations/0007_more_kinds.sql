-- Больше видов дневника: любимые люди, первые разы, благодарности, сны, семья
alter table diaries drop constraint if exists diaries_kind_check;
alter table diaries add constraint diaries_kind_check
  check (kind in ('memories', 'travel', 'work', 'insights', 'love', 'firsts', 'gratitude', 'dreams', 'family', 'custom'));
