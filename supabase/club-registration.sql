-- Additional club players are added immediately; only the server can write.
begin;
create table if not exists public.club_players (
  player_id text primary key check (player_id ~ '^([0-9]{1,10}|local-[a-f0-9-]{36})$'),
  name text not null check (length(name) between 5 and 120),
  name_key text not null unique,
  teams text[] not null check (cardinality(teams) > 0 and teams <@ array['a','b']::text[]),
  points double precision not null default 0 check (points >= 0),
  photo_url text,
  created_at timestamptz not null default now()
);
alter table public.club_players enable row level security;
revoke all on public.club_players from anon, authenticated;
grant select, insert, update, delete on public.club_players to service_role;
alter table public.player_accounts drop constraint if exists player_accounts_player_id_check;
alter table public.player_accounts add constraint player_accounts_player_id_check check (player_id ~ '^([0-9]{1,10}|local-[a-f0-9-]{36})$');
create or replace function public.register_club_account(
  p_user_id uuid, p_team_id text, p_player_id text, p_name text,
  p_name_key text, p_points double precision, p_photo_url text, p_position text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_team_id not in ('a','b') or p_position not in ('LEFT','RIGHT','BOTH') then raise exception 'Invalid selection'; end if;
  -- The unique name and player constraints also protect simultaneous signups.
  insert into public.club_players(player_id,name,name_key,teams,points,photo_url)
  values (p_player_id,p_name,p_name_key,array[p_team_id],p_points,p_photo_url)
  on conflict (player_id) do update set teams = (
    select array_agg(distinct t) from unnest(public.club_players.teams || excluded.teams) t
  );
  perform public.link_player_account(p_user_id,null,p_player_id,p_position);
end;
$$;
revoke all on function public.register_club_account(uuid,text,text,text,text,double precision,text,text) from public, anon, authenticated;
grant execute on function public.register_club_account(uuid,text,text,text,text,double precision,text,text) to service_role;
commit;
