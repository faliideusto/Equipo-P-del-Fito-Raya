create table if not exists public.coach_credentials (
  id text primary key check (id = 'coach'),
  salt text not null,
  hash text not null
);
alter table public.coach_credentials enable row level security;
revoke all on public.coach_credentials from anon, authenticated;
grant select, insert, update on public.coach_credentials to service_role;
