-- Persist the two Testnet transaction hashes the API used to drop
-- (Feature #438, WU1), so the role-based app can link each one to the
-- explorer once the scripted /evidence page is retired.
--
-- 1. campaign.deploy_transaction_hash — the hash `factory.deploy` returns for
--    the vault. It lives on the campaign mirror rather than on
--    campaign_deployment because `open-campaign` is the only place that sees
--    the hash and it writes the campaign row in the same step; both the
--    admin-approval deploy (#410) and `POST /campaigns` go through it, while
--    campaign_deployment exists only for the former. Nullable: campaigns
--    mirrored before this migration, and vaults adopted from an earlier
--    attempt, have no known hash and stay NULL ("no data", never a fake value).
--    The existing table-level service_role INSERT/UPDATE grant on campaign
--    already covers the new column; anon/authenticated still have nothing.
--
-- 2. campaign_contribution_transaction — one row per contribute transaction.
--    campaign_contribution stays the per-investor aggregate the vault reports;
--    this table keeps each contribution's own hash. The API records the row
--    from the verified signed envelope *before* submitting it (hash, investor,
--    amount) and stamps observed_at when the transaction poll sees success.
--    A row with observed_at NULL is a submission never (or not yet) confirmed
--    and is not evidence of a contribution. withdraw/refund are not recorded:
--    their amount is decided by the contract, not carried in the envelope.
--
-- Reversal: drop table public.campaign_contribution_transaction;
--           alter table public.campaign drop column deploy_transaction_hash;

alter table public.campaign
  add column if not exists deploy_transaction_hash text;

alter table public.campaign
  drop constraint if exists campaign_deploy_transaction_hash_format_check;
alter table public.campaign
  add constraint campaign_deploy_transaction_hash_format_check
  check (deploy_transaction_hash is null or deploy_transaction_hash ~ '^[0-9a-f]{64}$');

create table if not exists public.campaign_contribution_transaction (
  -- The signed envelope's identity: a resubmission carries the same hash, so
  -- the primary key is what makes the API's insert-or-ignore idempotent.
  transaction_hash             text primary key
    constraint campaign_contribution_transaction_hash_format_check
    check (transaction_hash ~ '^[0-9a-f]{64}$'),
  campaign_id                  uuid not null
    references public.campaign(campaign_id) on delete cascade,
  investor_account_id          text not null
    constraint campaign_contribution_transaction_investor_format_check
    check (investor_account_id ~ '^G[A-Z2-7]{55}$'),
  -- Integer money in stroops, as every other mirror stores it.
  amount_stroops               bigint not null
    constraint campaign_contribution_transaction_amount_check
    check (amount_stroops > 0),
  -- When the chain reported the transaction successful; NULL while only
  -- submitted.
  observed_at                  timestamptz,
  last_correlation_id          uuid not null,
  created_at                   timestamptz not null default now()
);

-- Postgres does not index foreign keys; readers list a campaign's
-- contributions and an investor's own across campaigns.
create index if not exists campaign_contribution_transaction_campaign_id_idx
  on public.campaign_contribution_transaction (campaign_id);
create index if not exists campaign_contribution_transaction_investor_idx
  on public.campaign_contribution_transaction (investor_account_id);

-- Access control: RLS enabled with zero policies, like every other campaign
-- mirror. The API connects as service_role and access is decided by grants.
-- Supabase grants service_role broad privileges on new tables by default, so
-- the revoke includes it before the precise grants below.
alter table public.campaign_contribution_transaction enable row level security;

revoke all on public.campaign_contribution_transaction from anon, authenticated, service_role;

-- Read + insert (ON CONFLICT DO NOTHING needs INSERT only), plus a
-- column-scoped UPDATE that can stamp the confirmation and nothing else: the
-- hash, campaign, investor and amount are unwritable after insert, and there
-- is no DELETE.
grant select, insert on public.campaign_contribution_transaction to service_role;
grant update (observed_at, last_correlation_id)
  on public.campaign_contribution_transaction to service_role;
