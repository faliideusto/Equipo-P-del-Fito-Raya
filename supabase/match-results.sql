-- Club record of results entered by players. SNP is never written from the app.
create table if not exists public.match_results (
  fixture_id text not null check (fixture_id ~ '^[0-9]{1,10}$'),
  team_id text not null check (team_id in ('a', 'b')),
  pair_index smallint not null check (pair_index between 1 and 5),
  sets jsonb not null,
  player_id text not null,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (fixture_id, team_id, pair_index)
);
create table if not exists public.match_absences (
  user_id uuid not null references auth.users(id) on delete cascade,
  fixture_id text not null check (fixture_id ~ '^[0-9]{1,10}$'),
  reason text not null default 'absent' check (reason in ('absent', 'already_reported')),
  created_at timestamptz not null default now(),
  primary key (user_id, fixture_id)
);
alter table public.match_results enable row level security;
alter table public.match_absences enable row level security;
revoke all on public.match_results from anon, authenticated;
revoke all on public.match_absences from anon, authenticated;
grant select, insert, delete on public.match_results to service_role;
grant select, insert on public.match_absences to service_role;
