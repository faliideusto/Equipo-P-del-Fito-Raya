-- Wallet passes: one per player and club team. Only the server can read or write them.
create table if not exists public.wallet_passes (
  serial uuid primary key,
  player_id text not null check (player_id ~ '^[0-9]{1,10}$'),
  team_id text not null check (team_id in ('a', 'b')),
  auth_token text not null check (length(auth_token) >= 32),
  google_object_id text,
  updated_at timestamptz not null default now(),
  unique (player_id, team_id)
);
-- Apple devices that registered a pass for updates.
create table if not exists public.wallet_devices (
  device_id text not null,
  serial uuid not null references public.wallet_passes(serial) on delete cascade,
  push_token text not null,
  primary key (device_id, serial)
);
-- The lineup the coach published for a fixture: a frozen copy of the pairs in pair order.
create table if not exists public.published_lineups (
  team_id text not null check (team_id in ('a', 'b')),
  fixture_id text not null check (fixture_id ~ '^[0-9]{1,10}$'),
  lineup_id uuid,
  pairs jsonb not null,
  published_at timestamptz not null default now(),
  primary key (team_id, fixture_id)
);
alter table public.wallet_passes enable row level security;
alter table public.wallet_devices enable row level security;
alter table public.published_lineups enable row level security;
revoke all on public.wallet_passes, public.wallet_devices, public.published_lineups from anon, authenticated;
grant select, insert, update, delete on public.wallet_passes, public.wallet_devices, public.published_lineups to service_role;
