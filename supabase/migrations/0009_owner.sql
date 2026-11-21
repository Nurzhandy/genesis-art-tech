-- Аккаунты (план 21.11, часть A): у дневника появляется владелец — пользователь Supabase Auth.
-- Старые дневники без владельца работают как раньше, по ключу дневника (x-diary-key).
alter table diaries add column if not exists owner_id uuid references auth.users(id) on delete set null;
create index if not exists diaries_owner_idx on diaries(owner_id);
