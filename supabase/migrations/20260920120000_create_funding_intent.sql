-- Create funding_intent: the durable record of one submitted funding intent
-- (Feature #24), keyed by the client-supplied intent_id.
--
-- A row is only ever written by a verified submission: the prepare step is
-- stateless (design D2), so there is no draft to persist. #24 can therefore
-- produce exactly one state — 'submitted' (acceptance criterion 3, design D3) —
-- and the CHECK below makes that a database-enforced fact rather than a
-- convention only the application layer keeps. #25 widens the constraint in its
-- own migration when asynchronous confirmation lands; this is deliberate, not
-- an oversight.
create table if not exists public.funding_intent (
  intent_id              uuid primary key,
  state                  text not null,
  network                text not null,
  network_passphrase     text not null,
  source_account_id      text not null,
  -- uint64: text, never a numeric type.
  source_sequence        text not null,
  destination_account_id text not null,
  -- Integer money in stroops. Never numeric, never a float; 1 XLM = 10,000,000.
  amount_stroops         bigint not null,
  -- Nullable: an intent may legitimately carry no memo.
  memo                   text,
  expires_at             timestamptz not null,
  -- The pertinent signed envelope — the one #25 will submit.
  signed_xdr             text not null,
  -- Unique: one signed transaction must not fund two intents.
  transaction_hash       text not null,
  application_id         uuid,
  last_correlation_id    uuid not null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint funding_intent_state_check check (state = 'submitted'),
  -- Integer money is positive by construction: a zero or negative funding intent
  -- is not an instruction to move money. The contract (WU3) enforces the same
  -- invariant; this stops the database from accepting what the API would refuse.
  constraint funding_intent_amount_stroops_check check (amount_stroops > 0),
  constraint funding_intent_transaction_hash_key unique (transaction_hash),
  -- Traceability link only: #24 does not require an approved application
  -- (design D4), so application_id stays nullable and is not state-checked.
  --
  -- ON DELETE SET NULL deliberately deviates from human_decision's ON DELETE
  -- CASCADE. A human decision is an audit row *of* its application; a funding
  -- record is financial evidence in its own right. Deleting the application
  -- must not delete the evidence of a signed instruction to move money — it
  -- only drops a link that no longer has a referent.
  constraint funding_intent_application_id_fkey
    foreign key (application_id)
    references public.application_review(application_id)
    on delete set null
);

-- Postgres does not index foreign keys automatically. #29's dashboard reads
-- decisions and funding together by application, so the correlation column gets
-- its index now rather than when that query is already running.
create index if not exists funding_intent_application_id_idx
  on public.funding_intent (application_id);

-- Maintain updated_at server-side; the API never supplies it directly.
-- SECURITY INVOKER (the default) so the trigger runs with the caller's
-- privileges, never escalating access (same pattern as
-- set_application_review_updated_at).
create or replace function public.set_funding_intent_updated_at()
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

drop trigger if exists funding_intent_set_updated_at on public.funding_intent;

create trigger funding_intent_set_updated_at
  before update on public.funding_intent
  for each row
  execute function public.set_funding_intent_updated_at();

-- Access control: RLS enabled with zero policies, deliberately. The API is the
-- only writer and connects as service_role; access is decided by the GRANT
-- layer, not by RLS policies. Funding intent rows are financial evidence and
-- immutable after submission, so service_role receives read + insert only — no
-- update and no delete.
--
-- Supabase grants service_role broad privileges on new tables by default, so
-- revoking from anon/authenticated alone would leave the table mutable through
-- the service role (see 20260919203900_enforce_human_decision_grant_immutability.sql).
--
-- No RLS policies here, exactly like application_review and human_decision:
-- this table joins the "RLS enabled, zero policies" set tracked by issue #196.
-- Until user-facing policies land there, any future GRANT on this table to a
-- role that does not bypass RLS would be unrestricted at the row level.
alter table public.funding_intent enable row level security;

revoke all on public.funding_intent from anon, authenticated;

revoke all on public.funding_intent from service_role;
grant select, insert on public.funding_intent to service_role;
