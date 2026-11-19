-- Дневник атмосферы: начальная схема (docs/plan/part-A-backend-input.md, задача A1)

create table if not exists diaries (
  id text primary key,
  created_at timestamptz not null default now()
);

create table if not exists days (
  id uuid primary key default gen_random_uuid(),
  diary_id text not null references diaries(id) on delete cascade,
  date date not null,
  title text,
  slug text,
  text text not null,
  photos jsonb not null default '[]',
  song jsonb not null,
  music jsonb,
  analysis jsonb,
  style jsonb,
  voice jsonb,
  poster_path text,
  status text not null default 'draft'
    check (status in ('draft', 'generating', 'ready', 'error')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists days_diary_date_idx on days (diary_id, date desc);

-- Доступ только через API-роуты с service role: RLS включён, политик нет.
alter table diaries enable row level security;
alter table days enable row level security;

insert into diaries (id) values ('demo') on conflict do nothing;

-- Приватный bucket для папок дней (лимит файла 15 MB)
insert into storage.buckets (id, name, public, file_size_limit)
values ('days', 'days', false, 15728640)
on conflict (id) do nothing;
