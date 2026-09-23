-- Replace the funding-intent mirror with campaign custody mirrors.
--
-- Reversal (before data migration): drop the three campaign tables and their
-- triggers/functions, then rename funding_intent_legacy back to funding_intent.
-- This keeps the delivered #24 evidence intact while making the active funding
-- path explicit: the contract is authoritative for money; these rows mirror it.
alter table if exists public.funding_intent rename to funding_intent_legacy;

create table if not exists public.campaign (
  campaign_id                  uuid primary key,
  application_id               uuid not null
    references public.application_review(application_id) on delete restrict,
  contract_address             text not null unique,
  network                      text not null,
  token_contract_address       text not null,
  goal_stroops                 bigint not null check (goal_stroops > 0),
  deadline                     timestamptz not null,
  state                        text not null check (state in ('open', 'settled', 'refundable')),
  total_stroops                bigint not null check (total_stroops >= 0),
  reconciliation_status        text not null check (reconciliation_status in ('in_sync', 'diverged')),
  last_reconciled_at           timestamptz not null,
  last_diverged_at             timestamptz,
  last_correlation_id          uuid not null,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  constraint campaign_total_not_above_goal check (total_stroops <= goal_stroops)
);

create index if not exists campaign_application_id_idx on public.campaign (application_id);

-- One row per participant mirrors the vault's on-chain contributor index.
-- The amount is observed from the contract; it is never a client declaration.
create table if not exists public.campaign_contribution (
  campaign_id                  uuid not null
    references public.campaign(campaign_id) on delete cascade,
  investor_account_id          text not null,
  amount_stroops               bigint not null check (amount_stroops > 0),
  last_observed_at             timestamptz not null,
  last_correlation_id          uuid not null,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  primary key (campaign_id, investor_account_id)
);

-- Contact data stays off-chain and out of logs. A notification worker can read
-- this row only after reconciliation marks the campaign refundable.
create table if not exists public.campaign_refund_contact (
  campaign_id                  uuid not null,
  investor_account_id          text not null,
  notification_email           text not null
    check (char_length(btrim(notification_email)) between 3 and 320),
  refund_due_at                timestamptz,
  notified_at                  timestamptz,
  last_correlation_id          uuid not null,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  primary key (campaign_id, investor_account_id),
  constraint campaign_refund_contact_contribution_fkey
    foreign key (campaign_id, investor_account_id)
    references public.campaign_contribution(campaign_id, investor_account_id)
    on delete cascade,
  constraint campaign_refund_contact_notification_order_check
    check (notified_at is null or refund_due_at is not null)
);

create or replace function public.set_campaign_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists campaign_set_updated_at on public.campaign;
create trigger campaign_set_updated_at
  before update on public.campaign
  for each row execute function public.set_campaign_updated_at();

drop trigger if exists campaign_contribution_set_updated_at on public.campaign_contribution;
create trigger campaign_contribution_set_updated_at
  before update on public.campaign_contribution
  for each row execute function public.set_campaign_updated_at();

drop trigger if exists campaign_refund_contact_set_updated_at on public.campaign_refund_contact;
create trigger campaign_refund_contact_set_updated_at
  before update on public.campaign_refund_contact
  for each row execute function public.set_campaign_updated_at();

alter table public.campaign enable row level security;
alter table public.campaign_contribution enable row level security;
alter table public.campaign_refund_contact enable row level security;

revoke all on public.campaign from anon, authenticated, service_role;
revoke all on public.campaign_contribution from anon, authenticated, service_role;
revoke all on public.campaign_refund_contact from anon, authenticated, service_role;

grant select, insert, update on public.campaign to service_role;
grant select, insert, update on public.campaign_contribution to service_role;
grant select, insert, update on public.campaign_refund_contact to service_role;

-- Historical funding intents must stay inspectable for evidence, but the active
-- API no longer writes or transitions them.
revoke all on public.funding_intent_legacy from anon, authenticated, service_role;
grant select on public.funding_intent_legacy to service_role;
