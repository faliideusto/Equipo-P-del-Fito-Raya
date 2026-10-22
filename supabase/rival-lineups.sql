-- Expected lineup of the next rival of each club team, and the lineup of ours planned against it,
-- saved by the coach or a captain.
-- Only the server can read or write it. Safe to run again.
create table if not exists public.rival_lineups (
  team_id text not null check (team_id in ('a', 'b')),
  fixture_id text not null check (fixture_id ~ '^[0-9]{1,10}$'),
  rival_id text not null check (rival_id ~ '^[0-9]{1,10}$'),
  pairs jsonb not null,
  own_pairs jsonb,
  updated_at timestamptz not null default now(),
  primary key (team_id, fixture_id)
);
alter table public.rival_lineups add column if not exists own_pairs jsonb;
alter table public.rival_lineups enable row level security;
revoke all on public.rival_lineups from anon, authenticated;
grant select, insert, update, delete on public.rival_lineups to service_role;
