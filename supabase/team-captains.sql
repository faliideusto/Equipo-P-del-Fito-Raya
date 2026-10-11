-- One captain per club team, chosen by the coach. Only the server can read or write it.
create table if not exists public.team_captains (
  team_id text primary key check (team_id in ('a', 'b')),
  player_id text not null check (player_id ~ '^[0-9]{1,10}$'),
  updated_at timestamptz not null default now()
);
alter table public.team_captains enable row level security;
revoke all on public.team_captains from anon, authenticated;
grant select, insert, update, delete on public.team_captains to service_role;
