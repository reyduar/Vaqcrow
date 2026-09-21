# Asynchronous Stellar confirmation (issue #25)

## Objective
Deliver GitHub issue #25 — Feature "Confirm Stellar transactions asynchronously" — through its
ordered Tasks: #80 Implement → #81 Test → #82 Document evidence.

The Feature's three acceptance criteria are the real contract (verbatim from the issue; the Task
bodies are boilerplate):

1. **Initial response is submitted.**
2. **Horizon polling is bounded and resumable.**
3. **Explorer links and failure reasons are visible.**

Task #80's functional requirement (verbatim): "Track submitted transactions through Horizon until
confirmed or failed, support bounded retries and resumption, preserve idempotency, and expose the
Testnet explorer link."

## Baseline
`main` at `4d3c6ce` (verified equal to `origin/main` on 2026-09-21). Branches:
`Vaqcrow#25_Feat_Confirm_Stellar_transactions_asynchronously` (integration and tracking, per
`docs/planning/demo-tasks-list.md` §#25) with
`Vaqcrow#80_Task_Implement_asynchronous_Stellar_confirmation` stacked on it; #81 and #82 stack on
#80 in turn, the same shape #24 used.

## Constraints
- Node 24 (`>=24 <25`); pnpm 11.27.0 pinned. The system `node` is v26, so commands run with
  `PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"`.
- Code, tests, commits and PR bodies in English. Conventional commits, no AI attribution.
- Boundaries (`.dependency-cruiser.cjs`): `apps/api/src/application/` may not **runtime**-import
  `@stellar/*`, `@supabase/*`, `fastify` or LLM SDKs (type-only allowed). Every Horizon call lives in
  `infrastructure/adapters/`, behind a port. `@stellar/freighter-api` must not appear in `apps/api`.
- `pnpm run verify` must stay free of Testnet, Horizon, Freighter and LLM providers.
- Money is integer-only (stroops). Never a float; reuse `xlmToStroops`.
- `DEMO.md` §7 line 261 puts **Horizon** — not Stellar RPC — in charge of "cuentas, operaciones y
  confirmación de pagos clásicos". The `data` skill prefers RPC for new projects, but the repo's
  scope document is authoritative for this demo, so Horizon is the source of `confirmed`.
- `DEMO.md` §11 line 374: "No cambiar un estado a confirmado manualmente." No state is ever set by
  hand; only Horizon moves a row out of `submitted`.

## Shared gate — skills / MCP discovery
`skill_resolution: skill-registry`. No dependency is added by this Feature —
`@stellar/stellar-sdk` and `@supabase/supabase-js` are already installed and boundary-enforced — so
the gate applies to authoring skills only. Matched from `.atl/skill-registry.md` by technology:

- `dapp` — Stellar SDK transaction submission and error handling.
- `data` — Horizon transaction lookup, pagination and retry/backoff semantics.
- `supabase` + `supabase-postgres-best-practices` — the state-widening migration, column-scoped
  grants and the idempotent transition.

No MCP server is required for authoring; recorded as `mcp_support: none`.

## Design decisions

- **D1 — Option A: the bounded poll lives in `apps/api`; no `apps/worker` is created.** `DEMO.md`
  line 150 makes the worker conditional — "`apps/worker` se agrega únicamente si las confirmaciones o
  jobs acotados no caben de forma segura en el proceso de la API" — line 318 lists the separate
  worker as *cut* work "si el polling durable cabe de forma segura en el servicio API", and §14 line
  413 carries it as open decision P1. A bounded, non-blocking poll with persisted state fits the API,
  so the condition for adding the workspace is not met. Option B (a fourth workspace) was rejected as
  real scope growth in a two-week sprint: a new dependency-cruiser rule set, a new deploy target and
  a new CI entry, buying isolation rather than capability — because "bounded and resumable" forces
  persisted state wherever the loop lives, so a restart loses nothing either way. The decision is
  recorded here with the criterion it is judged against, rather than silently taken.

- **D2 — the state vocabulary is exactly `submitted`, `confirmed`, `failed`.** The issue names those
  three. `manual_review` from `product.md` §8.1 stays production roadmap, exactly as #24's D3 already
  ruled: `product.md` is the real-product roadmap beyond the demo, which `AGENTS.md` states
  explicitly. Widening the CHECK later costs a migration, so the vocabulary is fixed deliberately
  now and the boundary is stated rather than left implicit.

- **D3 — "bounded" is bounded by the envelope's own `maxTime`, not by a retry count alone.** #24
  already persists `expires_at`, which is the `maxTime` the signature committed to. After that
  instant Stellar can never include the transaction, so it is a *real* terminal bound rather than an
  arbitrary policy number. Inside it, each poll run is bounded by a maximum attempt count with
  backoff; an exhausted run leaves the row `submitted` with `next_attempt_at` set, which is precisely
  what makes the next run a *resumption* rather than a fresh start.

- **D4 — `failed` is reached from three evidence-backed paths, never by hand.** (1) Horizon *refuses
  the submission* with `result_codes` — the transaction never entered a ledger; (2) Horizon *includes
  the transaction and reports it unsuccessful* (`successful: false`, `result_codes.transaction`) — it
  entered a ledger and failed; (3) the envelope's `maxTime` passes with no inclusion — Horizon will
  never include it, so it is `failed` with an `expired` reason. Path 3 is why D3 can be honest: an
  exhausted poll that has *not* expired stays `submitted`, because Vaqcrow does not know the outcome
  and must not invent one. Horizon remains the only source of `confirmed`.

- **D5 — a new port owns submission and its read-back; `LedgerPort` stays read-only.** `LedgerPort`'s
  own doc says its shapes are "nothing in this shape is — or can become — key material" and it models
  exactly one operation (`getAccount`). Submission and lookup-by-hash are the same Horizon resource
  (`/transactions`) and are a write/read-back pair, so splitting them across two ports would let a
  caller look up a hash it never submitted. The new port is `StellarTransactionPort`; `LedgerPort` is
  untouched.

- **D6 — the transition is a conditional `UPDATE ... WHERE intent_id = $1 AND state = $from`**,
  mirroring `record_human_decision`'s pattern rather than an upsert, so a replayed confirmation is
  idempotent instead of double-applying. A transition that matches no row is reported as a
  non-application, not as an error.

- **D7 — the service role receives column-scoped UPDATE, not table-wide UPDATE.** #24 granted
  `select, insert` only and its A5 called the table append-only. #25 makes the row a state machine,
  so UPDATE becomes necessary — but scoped to the confirmation columns
  (`state`, `confirmation_attempts`, `next_attempt_at`, `confirmed_at`, `failure_reason`,
  `ledger_sequence`, `last_correlation_id`). The financial-evidence columns (`intent_id`,
  `amount_stroops`, `transaction_hash`, `signed_xdr`, `network_passphrase`, `source_*`, …) stay
  unwritable, which is the same instinct as `20260919203900_enforce_human_decision_grant_immutability.sql`.
  This deliberately revises A5 rather than contradicting it: the append-only claim was true of the
  operations #24 needed, and stops being true the moment a confirmation is recorded.

- **D8 — the explorer link is derived at read time, never stored.** The hash is already persisted, so
  the link is `{explorerBaseUrl}/tx/{hash}`; storing it would be a second source of truth for a fact
  the hash already determines. `DEMO.md` §7 line 277 lists "URL del explorador" among the minimum
  variables, and `stellar-config.ts` has no such value today, so #25 adds `STELLAR_EXPLORER_URL`
  following the `STELLAR_HORIZON_URL` precedent: absent means the canonical Testnet explorer, present
  must be an absolute `http(s)` URL.

- **D9 — submission goes through `POST /transactions_async`, not `POST /transactions`.** The
  synchronous endpoint "blocks and waits for the transaction to be ingested in Horizon" (the SDK's
  own words), which on Testnet means waiting for a ledger to close and on a bad day means waiting
  until it times out. A bounded, resumable poll must not have a tick that can be held for an
  unbounded wait, so the asynchronous endpoint — which "relays the response from core directly back
  to the user" — is the right shape. It is also the architecture `DEMO.md` describes. The cost is
  explicit and accepted: a submission stops being a verdict, because core can accept a transaction
  that never reaches a ledger. That is not a hole in the design, it is the reason the poll exists,
  and the envelope's own `maxTime` (D3) bounds it.

- **D10 — the failure vocabulary is closed at six values, and Horizon's enum never crosses the
  boundary.** Horizon reports about thirty `tx_*` result codes; passing one through would make a
  provider's internal enum into Vaqcrow's wire contract, so a Horizon or protocol upgrade could
  change a value a person reads. The mapping happens once, in the adapter, and anything unmapped is
  `unsuccessful` — honest about what Vaqcrow knows rather than pretending to precision it lacks. A
  test pins the closure by rejecting `tx_bad_seq` and friends explicitly.

- **D11 — a transaction Horizon has not ingested is `pending`, not an error.** Horizon serves its
  lookup from ingested history, so a transaction that has not reached a ledger is simply absent.
  That is the expected state of every submission for its first few seconds, so `not_found` is an
  outcome rather than a failure to retry. This is exactly why D3's bound matters: the poll terminates
  on the envelope's `maxTime`, not on Horizon eventually answering.

## Tasks
- [x] T1 Recon: #25/#80/#81/#82, roadmap entries, existing ports/adapters/routes, boundaries, skills
- [x] T2 Assign #80 (done via the API). Moving #25 and #80 to `In progress` on Project #4 is a
      **manual step**: the board is a user-level Project and neither the GitHub MCP surface nor the
      issue-fields API exposes its `Status` field, so it cannot be set from here.
- [x] T3 WU1 — the confirmation state vocabulary and persistence contract: migration, contracts,
      repository port and adapter, with focused tests — `f12ed77`, `602a855`, `ae9497d`
- [x] T4 WU2 — `StellarTransactionPort` and its Horizon adapter (submit + lookup by hash), with a
      deterministic double — `dbc8b31`, `3c68d60`, `be199c2`
- [ ] T5 WU3 — the bounded, resumable confirmation use case and the in-process scheduler that drives
      it (`apps/api`, per D1)
- [ ] T6 WU4 — explorer link and sanitised failure reason exposed on the HTTP surface; explorer URL
      configuration
- [ ] T7 #81 — the ordered test Task: success, failure, timeout and resume against a Horizon double
- [ ] T8 #82 — evidence document in Spanish, traceable to this log

## RED → GREEN

### WU1 — the confirmation state vocabulary and persistence contract
Three commits, each verified individually with `pnpm run verify` → **exit 0**.

- **RED (contracts)** — `pnpm --filter @vaqcrow/contracts exec vitest run src/funding-intent.test.ts`.
  **1 failed / 121 passed (122 collected)**:
  `expected [ 'submitted' ] to deeply equal [ 'submitted', 'confirmed', 'failed' ]`. The RED here is
  unusually honest: the existing suite *pinned the closed vocabulary*, so widening it is precisely
  what makes the test fail. No assertion was weakened to manufacture a failure.

- **RED (persistence)** — `pnpm --filter @vaqcrow/api exec vitest run
  src/infrastructure/adapters/supabase-funding-intent-repository.test.ts`. **18 failed / 21 passed
  (39 collected)**, in three distinct modes, which is what makes it worth recording:
  * 12 `TypeError: repository.<method> is not a function` for the three new operations.
  * 3 malformed-row cases (`negative attempt count`, `fractional attempt count`, `malformed ledger
    sequence`) that the adapter silently ignored, so it returned `ok` where the contract says
    `unavailable` — the decoder had no opinion on columns it did not know about.
  * 3 pre-existing tests that now fail on the widened record shape (`confirmationAttempts`,
    `nextAttemptAt`), because the record mirrors the row and the adapter did not decode them yet.

- **GREEN** — contracts **122 passed**; the persistence suite **39 passed** (it was 22 when #24 closed
  its WU2, per that log). No test was weakened.

- **The migration is applied and verified live** on 2026-09-21, as
  `20260921182333 / widen_funding_intent_confirmation`. Verified by query rather than by the success
  flag, because the three things this migration could get wrong are not observable locally:

  1. **Structure.** 21 columns (16 + the 5 new ones), 8 constraints (the 5 original plus
     `funding_intent_attempts_check`, `funding_intent_confirmed_evidence_check` and
     `funding_intent_failed_evidence_check`), 4 indexes (primary key, `transaction_hash` unique,
     `application_id`, and the new partial `funding_intent_pending_idx`), 0 rows.
  2. **The column-scoped grant, which was the real risk.** `has_table_privilege('service_role', …,
     'UPDATE')` → **false**, so the table-level revoke held and no broad UPDATE survived alongside
     the precise one. `has_column_privilege` → **true** for `state` and `confirmation_attempts`, and
     **false** for `amount_stroops`, `transaction_hash`, `signed_xdr` and `source_sequence`. That is
     the boundary working as designed: the confirmation poll can move the state and cannot rewrite
     the financial evidence. `anon` and `authenticated` hold neither UPDATE nor SELECT.
  3. **The CHECKs bite, in both directions.** Four residue-free failing inserts, each refused with
     `23514` by exactly the intended constraint: `confirmed` without its ledger evidence →
     `funding_intent_confirmed_evidence_check`; `submitted` **carrying** confirmed evidence → the
     same constraint, which is the equivalence form doing the work a one-directional CHECK would have
     missed; `manual_review` → `funding_intent_state_check`; a negative attempt count →
     `funding_intent_attempts_check`. A count afterwards read **0 rows**, so nothing was left behind.

- **Re-runnable, and proven by re-running.** The migration SQL was executed a second time through a
  plain statement rather than a second `apply_migration`, so the history carries one entry — the
  lesson #24 recorded after its duplicate `create_application_review` record. Every count was
  unchanged afterwards: 21 columns, 8 constraints, 4 indexes, 0 rows, the same 8 granted columns.

- **Full gate at HEAD** — `pnpm run verify` → **exit 0**. contracts **229**, domain **60**, api
  **348**, web **381**, root **74**, `boundaries` clean at **265 modules / 674 dependencies**. The
  single ESLint error caught on the first run was a now-unused import left by the interface
  narrowing below; it was removed rather than suppressed.

- **Widening a port exposed an interface-segregation defect, and fixing it shrank the diff rather
  than growing it.** The port went from two operations to five, and every consumer was depending on
  the whole of it to call one method: `prepare` needs no repository at all, `submit` needs the write,
  `get` needs the lookup, the route needs two. Each now depends on the slice it actually calls
  (`Pick<…>`), so the five test doubles got **smaller** — `get`'s double lost `submit`, `submit`'s
  lost `findById` — instead of each growing three never-called stubs. The alternative (three `vi.fn()`
  per double, six places) was rejected: it is the same defect restated in test code, and it would
  grow again with every future operation.

- **A fixture that would have started lying was caught by the gate, not by review.** Two suites used
  `state: "confirmed"` as their example of *a value the demo cannot produce* — the contracts snapshot
  test and the web gateway's "drifted snapshot" case. Both were true statements until this work unit
  and false after it, and the web one failed loudly in `pnpm run verify`. Both moved to
  `manual_review`. The live integration suite had the same fixture, and there the failure would have
  been **silent**: `state: "confirmed"` is still refused, but now by the terminal-evidence CHECK
  rather than the vocabulary one, so the assertion would have passed while testing a different
  constraint. It is corrected in the same commit that widens the CHECK, with the reason recorded
  inline.

### WU2 — the Horizon transaction port and its adapter
Three commits, each verified individually with `pnpm run verify` → **exit 0**.

- **Recon, because the design turned on it.** Nothing here was taken from memory. The installed
  `@stellar/stellar-sdk@17.1.0` was read directly: `server.d.ts` for the two submission methods and
  their documented blocking behaviour, `horizon_api.d.ts` for `SubmitAsyncTransactionResponse` and
  `TransactionFailedExtras`, `errors/transaction_failed.js` and `errors/wrap_http_error.js` for how a
  rejection is actually constructed, and the published JSON Schema for the `tx_status` enum. Two
  facts changed the design and neither is guessable: the async endpoint exists and is explicitly
  non-blocking, and `toSubmissionError` only produces a `TransactionFailedError` when the body
  carries `extras.result_codes` — which is what made a single `tx_status` classifier the right shape
  instead of one rule per HTTP status.

- **RED (contracts)** — `pnpm --filter @vaqcrow/contracts exec vitest run
  src/stellar-failure-reason.test.ts`. **18 failed / 18** — `Cannot find module`, because the
  vocabulary did not exist. The suite was written first and encodes the closure: it rejects
  `tx_bad_seq`, `tx_too_late`, `PENDING` and `TRY_AGAIN_LATER` by name, so re-opening the vocabulary
  cannot happen silently.

- **RED (adapter)** — `pnpm --filter @vaqcrow/api exec vitest run
  src/infrastructure/adapters/stellar-transaction.test.ts`. **1 file failed / no tests collected**:
  `Failed to load url ./stellar-transaction.js`. Same failure mode as #24's work units — the suite
  encoded the port contract before the adapter existed.

- **GREEN, then one honest correction that was mine.** The first run was **22 passed / 1 failed**, and
  the failure was a **defect in the test, not the adapter**: `handed.hash().toString("hex")` asserted
  64 characters and got 114. `hash()` returns a byte array, not a `Buffer`, so `toString("hex")` is
  silently ignored and the default comma-joined decimal form comes back. The assertion was wrong and
  was corrected to an explicit `Buffer.from(handed.hash()).toString("hex")` with a hex-shape check —
  the adapter was never at fault and was not changed to make it pass. Final: **23 passed**.

- **The typechecker caught a real runtime defect before the tests could.** The first draft read
  `record.ledger` to get the ledger sequence. On `ServerApi.TransactionRecord`, `ledger` is the
  **link** to the ledger resource — a call function, not a number — and the sequence lives on
  `ledger_attr`. `String(record.ledger)` would have stringified a function at runtime, producing a
  `ledgerSequence` that looked plausible and was meaningless. The narrow interface now uses the SDK's
  own name, so the mistake cannot type-check rather than merely being unlikely.

- **The `never leaks the provider's error message` assertion is not decoration.** It drives a
  `BadResponseError` carrying a fake stack trace and asserts the result's only key is `code`, matching
  the sanitisation habit the persistence adapter already has.

- **Full gate at HEAD** — `pnpm run verify` → **exit 0**. contracts **247** (was 229), domain **60**,
  api **371** (was 348), web **381**, root **74**, `boundaries` clean at **271 modules / 696
  dependencies**.

- **A shared Horizon factory replaced a duplicated helper rather than copying it.** Both adapters now
  construct their server through `createHorizonServer`, so the plain-HTTP allowance that lets a
  loopback double stand in for Testnet is decided in one place. `StellarLedger`'s behaviour is
  unchanged; its private helper moved.

## Advisories

- **A4 — the `tx_status` → HTTP-status mapping is inferred, not observed.** The SDK source shows that
  a non-2xx rejects and is turned into a `TransactionFailedError` only when the body carries
  `extras.result_codes`; third-party documentation puts `PENDING` at 201, `DUPLICATE` at 409,
  `TRY_AGAIN_LATER` at 503 and `ERROR` at 400, but the SDK does not state it. The adapter sidesteps
  the question by classifying on the body's `tx_status` field rather than on the transport status, so
  it is correct under either behaviour — but which statuses actually accompany which values is
  unverified, and only a live Horizon can settle it. It does not change any outcome the demo
  reports: every documented value maps to `accepted`, `rejected` or `unavailable` either way.

- **A5 — an included-but-failed transaction reports `unsuccessful`, not a specific reason.** A
  transaction that reaches a ledger and is refused by the network comes back from Horizon's lookup as
  `successful: false` with no decoded result codes — naming the exact cause would mean decoding the
  operation-level result out of `result_xdr`. The submit path, where the common failures live
  (`bad_sequence`, `insufficient_fee`, `insufficient_balance`), does give a specific code through
  `TransactionFailedError`. So the specificity gap is narrow and deliberate, and closing it is a
  self-contained follow-up if the demo ever needs to explain an execution failure.

- **A6 — `checkMemoRequired` runs before every submission unless it is skipped.** The SDK calls it by
  default, and it makes its own `loadAccount` round-trip to the destination. That is a second Horizon
  call inside a poll tick and a second way for a tick to fail — and its failure mode (a
  `AccountRequiresMemoError`) is a `BadResponseError` subclass the adapter does not model separately,
  so it currently surfaces as `unavailable` and is retried. Kept at the default because SEP-29's
  check is a real safety property, not ceremony, but it is worth knowing before the first live run.

- **A1 — the live integration suite does not encode what this work unit verified by hand.** The
  migration's structure, the column-scoped grant and both evidence CHECKs are now *observed* facts
  (above), but they live in this log rather than in
  `apps/api/tests/integration/funding-intent-persistence.integration.test.ts`, so nothing re-checks
  them on a future run. #81 owns closing that. The pattern is already proven and residue-free: use
  `has_table_privilege`/`has_column_privilege` for the grant (no role change and no row needed), and
  assert only on **failing** inserts for the CHECKs, since the table is append-only for the API role
  (A5 of #24) and a successful insert could never be cleaned up.

- **A2 — whether the `updated_at` grant is *necessary* is still open, and cannot be settled
  residue-free.** The granted columns are proven to work (A1 above), so this is a tightening
  opportunity rather than a risk: the trigger `set_funding_intent_updated_at` is SECURITY INVOKER and
  writes `new.updated_at` on every update, and it is not obvious from the documentation whether a
  BEFORE trigger's `NEW` assignment requires the caller to hold UPDATE on that column. Two obstacles
  stop a residue-free probe: a trigger only fires for a *matched* row, so a zero-row UPDATE never
  reaches the write and the privilege is never checked; and `now()` is transaction-scoped (#24's A3),
  so an insert and an update inside one rolled-back block cannot even show the trigger moving. A
  real two-transaction probe would leave a permanent row, which the API role cannot delete (A5 of
  #24). The column is granted and the adapter never sends it, so the grant is inert; removing it
  would tighten the boundary by one column and needs a disposable table to prove first.

- **A3 — the port's read shape now carries scheduling facts its readers ignore.** `findById` returns
  `confirmationAttempts` and `nextAttemptAt` because `FundingIntentRecord` mirrors the row, and a
  status read projects them away. That is correct but means four fixtures must carry fields their
  test never reads. If it becomes noisy, the fix is a narrower read type per use case, not an
  optional field on the record — the columns are NOT NULL and always present, so marking them
  optional would be a lie about the database.

## Review size and delivery chain
WU1 is three commits: `f12ed77` (the migration and the live fixture it invalidates), `602a855` (the
contract vocabulary and the two fixtures it invalidates) and `ae9497d` (the port, the adapter, the
interface narrowing and the tests). Each was verified green on its own, so `git bisect` stays usable
and the three concerns — schema, contract, persistence — can be read in that order. The migration is
**already applied to the live Supabase project** (`20260921182333`), verified by query as recorded
above; the code is therefore in step with the database rather than ahead of it.

WU2 is three more: `dbc8b31` (the closed failure vocabulary), `3c68d60` (the shared Horizon factory)
and `be199c2` (the port and its adapter). Each was verified green on its own. The vocabulary can be
read without the adapter, the factory is a pure refactor, and the adapter is the only commit that
depends on both.

The branch is not yet pushed and no PR is open. WU3 — the bounded, resumable confirmation use case and
the in-process scheduler that drives it — is the next unit. It is the first one that consumes both
halves already built, and it is where the retry policy, the expiry bound and the wiring in `index.ts`
land.

