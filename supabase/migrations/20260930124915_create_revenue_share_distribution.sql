-- Create revenue_share_distribution and its immutable recipient rows
-- (Feature #28, Task #89).
--
-- A distribution is a single classic Testnet transaction with one native
-- payment per recipient (design D2). A row is only ever written by a verified
-- submission: prepare is stateless (D4), so there is no draft to persist. The
-- parent mirrors funding_intent's discipline — keyed on transaction_hash,
-- conditional state transitions, Horizon the sole authority for the two
-- terminal states — while the financial facts are a *list* rather than a single
-- payment (D3), so the recipients live in their own append-only child table.
--
-- Two boundaries this migration establishes by privilege rather than by the
-- adapter remembering to behave:
--   * The parent's financial facts (identity, network, source, sequence, memo,
--     expiry, signed envelope, transaction hash, application link, created_at)
--     are unwritable after insert — the API role gets a column-scoped UPDATE
--     that excludes every one of them.
--   * The recipient rows are immutable: the API role gets INSERT + SELECT on the
--     child table and no UPDATE/DELETE, so a persisted allocation cannot be
--     rewritten after the fact.

create table if not exists public.revenue_share_distribution (
  distribution_id       uuid primary key,
  state                 text not null,
  network               text not null,
  network_passphrase    text not null,
  source_account_id     text not null,
  -- uint64: text, never a numeric type.
  source_sequence       text not null,
  -- Nullable: a distribution may legitimately carry no memo.
  memo                  text,
  expires_at            timestamptz not null,
  -- The signed envelope, retained so the confirmation step can re-offer it to
  -- the network. The status response deliberately omits it; the record keeps it.
  signed_xdr            text not null,
  -- Unique: one signed transaction must not distribute twice.
  transaction_hash      text not null,
  application_id        uuid,
  -- A short, sanitised, non-sensitive reason. Present exactly when failed, and
  -- never Horizon's raw response.
  failure_reason        text,
  -- The polling schedule. NOT NULL with a now() default on purpose: a freshly
  -- submitted row is due immediately, so the pending query needs no NULL branch
  -- and a restart resumes a poll it did not start.
  confirmation_attempts integer not null default 0,
  next_attempt_at       timestamptz not null default now(),
  -- Horizon's ledger close time for the including ledger, not a local clock.
  confirmed_at          timestamptz,
  -- The ledger that included the transaction. bigint, like every Stellar
  -- sequence-ish counter; never an integer that could overflow silently.
  ledger_sequence       bigint,
  last_correlation_id   uuid not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint revenue_share_distribution_state_check
    check (state in ('submitted', 'confirmed', 'failed')),
  constraint revenue_share_distribution_transaction_hash_key unique (transaction_hash),
  constraint revenue_share_distribution_attempts_check check (confirmation_attempts >= 0),
  -- The equivalence form is deliberate: it forbids a confirmed row that lacks
  -- its evidence AND a non-confirmed row that carries evidence for a state it
  -- is not in.
  constraint revenue_share_distribution_confirmed_evidence_check
    check ((state = 'confirmed') = (confirmed_at is not null and ledger_sequence is not null)),
  constraint revenue_share_distribution_failed_evidence_check
    check ((state = 'failed') = (failure_reason is not null)),
  -- Traceability link only: a distribution does not require an approved
  -- application, so application_id stays nullable and is not state-checked.
  -- ON DELETE SET NULL, matching funding_intent: deleting the application must
  -- not delete the evidence of a signed instruction to move money.
  constraint revenue_share_distribution_application_id_fkey
    foreign key (application_id)
    references public.application_review(application_id)
    on delete set null
);

-- One row per native payment the envelope encoded, in envelope order.
create table if not exists public.revenue_share_distribution_recipient (
  distribution_id  uuid not null,
  -- Envelope order. A distribution's payments are order-sensitive, so position
  -- is part of the key, not metadata.
  position         integer not null,
  account_id       text not null,
  -- Integer money in stroops. bigint, never numeric and never a float;
  -- 1 XLM = 10,000,000. Same exact type funding_intent uses.
  amount_stroops   bigint not null,
  primary key (distribution_id, position),
  constraint revenue_share_distribution_recipient_distribution_id_fkey
    foreign key (distribution_id)
    references public.revenue_share_distribution(distribution_id)
    on delete cascade,
  constraint revenue_share_distribution_recipient_position_check check (position >= 0),
  constraint revenue_share_distribution_recipient_amount_stroops_check check (amount_stroops > 0)
);

-- Postgres does not index foreign keys automatically. The dashboard reads
-- distributions by application, so the correlation column gets its index now.
create index if not exists revenue_share_distribution_application_id_idx
  on public.revenue_share_distribution (application_id);

-- The pending read's index. Partial on `state = 'submitted'` because that is
-- exactly the predicate the confirmation poll uses, and terminal rows are never
-- polled again: the index stays proportional to the work outstanding, not to
-- the table's history.
create index if not exists revenue_share_distribution_pending_idx
  on public.revenue_share_distribution (next_attempt_at)
  where state = 'submitted';

-- Maintain updated_at server-side; the API never supplies it directly.
-- SECURITY INVOKER (the default) so the trigger runs with the caller's
-- privileges, never escalating access.
create or replace function public.set_revenue_share_distribution_updated_at()
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

drop trigger if exists revenue_share_distribution_set_updated_at on public.revenue_share_distribution;

create trigger revenue_share_distribution_set_updated_at
  before update on public.revenue_share_distribution
  for each row
  execute function public.set_revenue_share_distribution_updated_at();

-- Access control: RLS enabled with zero policies, deliberately. The API is the
-- only writer and connects as service_role; access is decided by the GRANT
-- layer, not by RLS policies. These tables join the "RLS enabled, zero policies"
-- set tracked by issue #196.
--
-- Supabase grants service_role broad privileges on new tables by default, so
-- revoking from anon/authenticated alone would leave the tables mutable through
-- the service role (see 20260919203900_enforce_human_decision_grant_immutability.sql).
alter table public.revenue_share_distribution enable row level security;
alter table public.revenue_share_distribution_recipient enable row level security;

revoke all on public.revenue_share_distribution from anon, authenticated, service_role;
revoke all on public.revenue_share_distribution_recipient from anon, authenticated, service_role;

-- The parent: read + insert, plus a column-scoped UPDATE that moves only the
-- state machine and its evidence. `updated_at` is included because the
-- SECURITY INVOKER trigger writes it on every update; the trigger overwrites
-- whatever arrives and the adapter never sends it. The table-level revoke
-- already above guarantees no broader UPDATE grant can survive alongside this
-- precise one.
grant select, insert on public.revenue_share_distribution to service_role;

grant update (
  state,
  confirmation_attempts,
  next_attempt_at,
  confirmed_at,
  ledger_sequence,
  failure_reason,
  last_correlation_id,
  updated_at
) on public.revenue_share_distribution to service_role;

-- The children: append-only. No UPDATE, no DELETE — the recipients are
-- immutable once a verified submission persisted them.
grant select, insert on public.revenue_share_distribution_recipient to service_role;
