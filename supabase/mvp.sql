create table if not exists public.monthly_mvp (
  team_id text not null check (team_id in ('a', 'b')),
  month text not null check (month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  player_id text not null,
  source_id text not null,
  name text not null,
  photo_url text,
  updated_at timestamptz not null default now(),
  primary key (team_id, month)
);
alter table public.monthly_mvp enable row level security;
revoke all on public.monthly_mvp from anon, authenticated;
grant select, insert, update on public.monthly_mvp to service_role;
