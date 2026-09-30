create table if not exists public.saved_lineups (
  id uuid primary key,
  team_id text not null check (team_id in ('a', 'b')),
  name text not null check (length(name) between 1 and 80),
  pairs jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.saved_lineups enable row level security;
revoke all on public.saved_lineups from anon, authenticated;
grant select, insert, delete on public.saved_lineups to service_role;
