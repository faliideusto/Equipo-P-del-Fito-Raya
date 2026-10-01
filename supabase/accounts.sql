-- Account ownership comes from Supabase Auth, never from a browser-supplied ID.
create table if not exists public.player_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snp_user_id text not null unique check (snp_user_id ~ '^[0-9]{1,10}$'),
  player_id text not null unique check (player_id ~ '^[0-9]{1,10}$'),
  position text not null check (position in ('RIGHT', 'LEFT', 'BOTH')),
  linked_at timestamptz not null default now()
);
alter table public.player_accounts enable row level security;
revoke all on public.player_accounts from anon, authenticated;
grant select, insert, update, delete on public.player_accounts to service_role;

-- Save the verified link and the player's choice atomically. A later coach
-- edit uses player_positions as usual and takes precedence until the user edits.
create or replace function public.link_player_account(
  p_user_id uuid, p_snp_user_id text, p_player_id text, p_position text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_position not in ('RIGHT', 'LEFT', 'BOTH') then
    raise exception 'Invalid position';
  end if;
  insert into public.player_accounts(user_id, snp_user_id, player_id, position)
  values (p_user_id, p_snp_user_id, p_player_id, p_position)
  on conflict (user_id) do update set snp_user_id = excluded.snp_user_id,
    player_id = excluded.player_id, position = excluded.position, linked_at = now();
  insert into public.player_positions(id, position)
  values ('a-' || p_player_id, p_position), ('b-' || p_player_id, p_position)
  on conflict (id) do update set position = excluded.position;
end;
$$;
revoke all on function public.link_player_account(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.link_player_account(uuid, text, text, text) to service_role;
