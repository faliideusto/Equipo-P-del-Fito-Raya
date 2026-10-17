-- Run once in the SQL Editor of your own Supabase project.
-- id is the SNP player id; the nickname is shown in lineups, rankings and Wallet.
create table if not exists public.player_nicknames (
  id text primary key,
  nickname text check (nickname is null or char_length(nickname) between 1 and 20)
);
alter table public.player_nicknames enable row level security;
revoke all on public.player_nicknames from anon, authenticated;
grant select, insert, update on public.player_nicknames to service_role;
-- No public policies. Only the server's secret key can access this table.
