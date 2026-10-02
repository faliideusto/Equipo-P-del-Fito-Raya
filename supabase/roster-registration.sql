-- Preserve existing verified associations. New roster selections have no SNP
-- account identity; player_id remains unique so A/B share the same account.
alter table public.player_accounts alter column snp_user_id drop not null;
