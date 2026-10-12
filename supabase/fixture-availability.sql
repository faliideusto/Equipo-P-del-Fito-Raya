-- Players available for each fixture, ticked by the coach or the captains. Only the server can read or write it.
create table if not exists public.fixture_availability (
  team_id text not null check (team_id in ('a', 'b')),
  fixture_id text not null check (fixture_id ~ '^[0-9]{1,10}$'),
  player_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (team_id, fixture_id)
);
alter table public.fixture_availability enable row level security;
revoke all on public.fixture_availability from anon, authenticated;
grant select, insert, update on public.fixture_availability to service_role;
