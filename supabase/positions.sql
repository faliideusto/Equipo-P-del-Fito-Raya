-- Run once in the SQL Editor of your own Supabase project.
create table if not exists public.player_positions (
  id text primary key,
  position text check (position in ('RIGHT', 'LEFT', 'BOTH'))
);
alter table public.player_positions enable row level security;
revoke all on public.player_positions from anon, authenticated;
grant select, insert, update on public.player_positions to service_role;
-- No public policies. Only the server's secret key can access this table.
