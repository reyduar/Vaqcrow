-- Add the SME's Stellar account id to the campaign mirror.
--
-- The account is captured when the vault opens (`campaign-vault-web-journey.md`
-- decision D7): the platform account creates the SME's account on-chain against
-- the public key the SME already holds in Freighter, and this column mirrors
-- that same public key so the API can address it without re-deriving it from
-- the contract.
--
-- `public.campaign` was verified empty in the remote project (0 rows on
-- 2026-09-24) before this migration, so adding a NOT NULL column with no
-- default is safe here.
-- A later migration on a populated table would need a default or a backfill
-- step first; this one does not.
--
-- Reversal:
--   alter table public.campaign drop constraint if exists campaign_sme_account_id_format_check;
--   alter table public.campaign drop column if exists sme_account_id;
--
-- No grant changes: the first migration's
-- `grant select, insert, update on public.campaign to service_role` already
-- covers every column on the table, including this one, and RLS stays exactly
-- as configured there (enabled, zero policies, service_role only).

alter table public.campaign add column if not exists sme_account_id text not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'campaign_sme_account_id_format_check'
  ) then
    alter table public.campaign
      add constraint campaign_sme_account_id_format_check
      check (sme_account_id ~ '^G[A-Z2-7]{55}$');
  end if;
end
$$;
