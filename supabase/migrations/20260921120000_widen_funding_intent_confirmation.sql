-- Widen funding_intent into a confirmation state machine (Feature #25).
--
-- #24 could persist exactly one state — 'submitted' — and pinned that with
-- `check (state = 'submitted')`, deliberately, so the constraint and the
-- application's vocabulary could not drift apart silently. #25 adds the two
-- terminal states Horizon is the sole authority for, so the CHECK widens to
-- admit them and the row grows the evidence each terminal state requires.
--
-- Two things this migration deliberately does NOT do:
--   * It does not admit `manual_review` or any pre-submission state from
--     product.md §8.1. Those belong to the production roadmap beyond the demo,
--     the same boundary #24's D3 already drew.
--   * It does not grant table-wide UPDATE. The financial facts a verified
--     submission persisted stay unwritable (see the grant section below).

-- 1. The state vocabulary: `submitted` -> `confirmed` | `failed`.
alter table public.funding_intent
  drop constraint if exists funding_intent_state_check;

alter table public.funding_intent
  add constraint funding_intent_state_check
  check (state in ('submitted', 'confirmed', 'failed'));

-- 2. The polling schedule and the terminal evidence.
--
-- `next_attempt_at` is NOT NULL with a `now()` default on purpose: a freshly
-- submitted row is due immediately, so the pending query needs no NULL branch
-- and a restart resumes a poll it did not start. This is what "resumable" rests
-- on — the schedule is a persisted fact, not an in-process timer.
alter table public.funding_intent
  add column if not exists confirmation_attempts integer not null default 0,
  add column if not exists next_attempt_at      timestamptz not null default now(),
  -- Horizon's ledger close time for the including ledger, not a local clock.
  add column if not exists confirmed_at         timestamptz,
  -- The ledger that included the transaction. bigint, like every Stellar
  -- sequence-ish counter; never an integer that could overflow silently.
  add column if not exists ledger_sequence      bigint,
  -- A short, sanitised, non-sensitive reason. Never Horizon's raw response.
  add column if not exists failure_reason       text;

-- 3. The invariants, pinned at the database rather than trusted to the adapter.
--
-- The equivalence form is deliberate: it forbids a terminal row that lacks its
-- evidence AND a non-terminal row that carries evidence for a state it is not
-- in. A `submitted` row holding a `confirmed_at` is incoherent, not merely
-- untidy, so it is refused rather than tolerated.
alter table public.funding_intent
  drop constraint if exists funding_intent_attempts_check;

alter table public.funding_intent
  add constraint funding_intent_attempts_check
  check (confirmation_attempts >= 0);

alter table public.funding_intent
  drop constraint if exists funding_intent_confirmed_evidence_check;

alter table public.funding_intent
  add constraint funding_intent_confirmed_evidence_check
  check ((state = 'confirmed') = (confirmed_at is not null and ledger_sequence is not null));

alter table public.funding_intent
  drop constraint if exists funding_intent_failed_evidence_check;

alter table public.funding_intent
  add constraint funding_intent_failed_evidence_check
  check ((state = 'failed') = (failure_reason is not null));

-- 4. The pending read's index.
--
-- Partial on `state = 'submitted'` because that is exactly the predicate the
-- confirmation poll uses, and terminal rows are never polled again: the index
-- stays proportional to the work outstanding, not to the table's history.
create index if not exists funding_intent_pending_idx
  on public.funding_intent (next_attempt_at)
  where state = 'submitted';

-- 5. Access control: column-scoped UPDATE, never table-wide.
--
-- #24 granted `select, insert` only and its iteration log called the table
-- append-only. That was true of the operations #24 needed and stops being true
-- the moment a confirmation is recorded, so UPDATE is now required — but only
-- on the columns a transition legitimately moves. The financial evidence
-- (`intent_id`, `network_passphrase`, `source_*`, `amount_stroops`,
-- `transaction_hash`, `signed_xdr`, `expires_at`, `application_id`,
-- `created_at`) stays unwritable by the API role, which is the same instinct as
-- 20260919203900_enforce_human_decision_grant_immutability.sql: the boundary is
-- enforced by privilege, not by the adapter remembering to behave.
--
-- `updated_at` is included because the SECURITY INVOKER trigger
-- `set_funding_intent_updated_at` writes it on every update. Granting the column
-- does not hand it to the caller: the trigger overwrites whatever arrives, and
-- the adapter never sends it.
--
-- The table-level revoke first makes the migration re-runnable and guarantees no
-- broader UPDATE grant can survive alongside the precise one.
revoke update on public.funding_intent from service_role;

grant update (
  state,
  confirmation_attempts,
  next_attempt_at,
  confirmed_at,
  ledger_sequence,
  failure_reason,
  last_correlation_id,
  updated_at
) on public.funding_intent to service_role;
