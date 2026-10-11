-- Captains of each club team, chosen by the coach. Only the server can read or write them.
create table if not exists public.team_captains (
  team_id text not null check (team_id in ('a', 'b')),
  player_id text not null check (player_id ~ '^[0-9]{1,10}$'),
  updated_at timestamptz not null default now(),
  primary key (team_id, player_id)
);
-- Older installs allowed one captain per team: widen the key so a team can have several. Safe to run again.
alter table public.team_captains drop constraint if exists team_captains_pkey;
alter table public.team_captains add primary key (team_id, player_id);
alter table public.team_captains enable row level security;
revoke all on public.team_captains from anon, authenticated;
grant select, insert, update, delete on public.team_captains to service_role;
