# Implement Testnet revenue-share distribution

Iteration log for issue #89 (Task under Feature #28), branch
`Vaqcrow#89_Task_Implement_Testnet_revenue_share_distribution`, base `8b34d57`.

## Objective

Let the SME review and sign a Testnet revenue-share distribution with Freighter, have the backend verify the
signed XDR, submit it asynchronously, and retain the hash, recipients and amounts — reusing the
repository's existing non-custodial classic-payment pattern instead of a parallel stack.

## Problem

Feature #28 requires the non-custodial distribution transaction. Today the repo has a complete classic
prepare → sign → submit → confirm path for a **single** funding payment
(`apps/api/src/infrastructure/adapters/stellar-funding-intent-xdr.ts`, `…/stellar-transaction.ts`,
`…/stellar-horizon.ts`), the revenue-share engine (#27) emits `allocations[]` in minor units, and the
web has `FreighterWallet` and a `TransactionReviewModal`. What does not exist is a **multi-recipient**
builder/verifier, a distribution entity with recipients and amounts, its HTTP surface, or the web flow.

## Why

`docs/planning/DEMO.md` steps 9–10 and §5: the obligation is computed deterministically by the engine and
the SME signs a classic Testnet distribution; the AI never calculates or moves funds. Distribution is its
own vertical step, so it gets its own entity and route rather than overloading the funding-intent one.

## Scope

In: distribution wire contracts; the N-payment XDR build/verify adapter; prepare/submit/get use cases; the
distribution repository port and Supabase adapter; the HTTP route and wiring; the web gateway and
workspace replacing the `/distribution` placeholder.

Out: Feature #28's test Task (#90) and evidence Task (#91); the Soroban vault path; any change to the
revenue-share engine; real investor-account provisioning.

## Design decisions

- **D1 — Recipients are `{ accountId, amountStroops }`.** The engine's `contributorId` is an opaque
  domain string, not a Stellar key. The distribution names actual destinations; the caller maps its
  allocation to `(accountId, amountStroops)` before prepare. Optional `contributorId` travels for
  traceability only and is never a transaction field.
- **D2 — N native payments, one transaction.** The distribution is a single classic transaction with one
  `Operation.payment` per recipient (native XLM), built and re-verified order-sensitively against the
  declared recipient list, mirroring the funding-intent single-payment discipline (network passphrase,
  source, sequence, memo, `maxTime`, at-least-one-source signature, no fee-bump).
- **D3 — Own entity, not the funding-intent table.** A `revenue_share_distribution` record with immutable
  recipient child rows, keyed on `transaction_hash`, conditional state transitions, same sanitized-error
  and idempotency contract as funding intents.
- **D4 — Prepare stays stateless.** Nothing is persisted until a verified submission (same as #24);
  the signed envelope is re-verified against the declared terms because the server has no other record.
- **D5 — Async confirmation reuses the existing port and scheduler.** `StellarTransactionPort` and
  `ConfirmationScheduler` are reused; the confirmation loop is generalised over a structural record/repo
  shape rather than duplicated.

## Stable checklist (slices)

- [x] S1 — Distribution contracts (`packages/contracts/src/revenue-share-distribution.ts`, id) + tests + barrel.
- [x] S2 — Backend core: XDR port + N-payment adapter; prepare/submit/get use cases; repository port +
      Supabase adapter; migration; HTTP route; wiring; confirmation; tests.
- [x] S3 — Web: gateway + `distribution` workspace/page reusing `FreighterWallet` and the review modal; tests.
- [ ] S4 — Focused checks + `pnpm run verify`; RDD for each work unit; docs and Engram mirror.

## Implementation evidence

| Slice | Commit | What landed | Tests |
|---|---|---|---|
| S1 | `624722c` | `revenue-share-distribution{,-id}.ts` + barrel; `contributorId` removed from `terms` so the terms stay exactly the envelope-committed facts | 131 |
| S2a | `14e897e` | `revenue-share-distribution-xdr-port.ts` + `stellar-revenue-share-distribution-xdr.ts`: N ordered native payments, envelope-bound verify (passphrase, fee-bump refusal, per-index recipient match, source signature) | 33 |
| S2b | `e03732a` | repository port + Supabase adapter + `20260929170119_create_revenue_share_distribution.sql` (immutable recipients, conditional transitions, scoped grants) | 48 |
| S2c | `33c94a4` | prepare/submit/get use cases + route (`/revenue-share-distributions`) + `build-app`/`index` wiring | 48 |
| S2d | `8c1f260` | `confirm-revenue-share-distributions.ts` + scheduler wiring (`submitted → confirmed/failed`, bounded backoff) | 26 |
| S2e | `2b75f55` | dedup: one shared `confirmation-policy.ts` + one generalized `ConfirmationScheduler`; the inline loop and the mirrored backoff are gone | — |
| S3 | `1712902` | web gateway + SIMULADO recipient fixture + `distribution` workspace/page | 29 |

Verified claims without an API or contract change to the revenue-share engine: the distribution consumes
the engine's allocations only as `(accountId, amountStroops)` supplied by the caller (D1).

## Constraints

- Strict TDD. `apps/api/src/application/**` stays provider-SDK-free; the web never imports the server SDK;
  `apps/api` never imports the wallet SDK; contracts stay Node-free and Fastify-free.
- Money is `bigint`; wire amounts are decimal strings.
- PR-gated tests never touch Testnet/Horizon/Freighter live; doubles and real-signed fixtures only.
- No secrets, seeds, PII, or unsupported production claims.
- Delivery strategy: `ask-on-risk` for this Feature.

## Forecast

Roughly 3 slices, each around or above the 400-line review budget; total well above it. The maintainer
chose **one PR with `size:exception`** (see §Delivery), so the slices ship as ordered work-unit commits on
this branch rather than chained PRs.

## Route declaration

- S1–S3 — delegated direct: one bounded writer per slice, with the mapper handoff and the decisions above
  attached; the S3 copy was corrected to the project's Spanish UI language after the first pass.
- S2e was an explicit dedup slice so the two confirmation loops share one scheduler and one backoff.
- Checks, RDD and commits — parent.

## Verification evidence

- `pnpm run verify` — **exit 0**: lint 5/5, typecheck 8/8, workspace test 8/8, build 5/5,
  `no dependency violations found (497 modules, 1540 dependencies cruised)`, `test:boundaries` 9 files /
  93 tests. Per package: contracts 13/475, domain 2/120, ai 5/107, api 46/934, web 103/737.
- Two real defects were caught and fixed before the gate went green:
  - a Testnet network-passphrase literal in the new web tests tripped the root guard
    `tests/web-holds-no-network-passphrase.test.ts`; replaced with the project's
    `passphrase-from-response` convention (`3bda2fd`);
  - the first `pnpm run verify` runs showed 5-second timeouts in unrelated web tests under `turbo`
    parallel load (different tests each run, all passing in isolation); one clean run confirmed green.
- No Supabase integration suite, Stellar Testnet, Horizon, Freighter or LLM provider was used.

## Review evidence

- The whole-range native review was refused with `lens_context_budget_exceeded` (31 files, 7339 lines):
  no review authority was created and nothing needed abandoning. The range was split into three
  candidates by maintainer decision.
- **Candidate A (contracts, S1)** — reviewed and **approved**, authority burned
  (lineage `review-3cd9fa5eef796d32`). Three non-blocking findings move to Task #90:
  - `R3-TERMS-SOURCE-CHECK` — `terms` passes `null` as the source, so `submit` (the authoritative
    boundary) accepts a recipient list containing the source account while `prepare` refuses it; the
    inline rationale claiming `terms` carries no source identity is wrong because `sourceAccountId` is a
    terms field.
  - `R3-SNAPSHOT-RECIPIENT-UNIQUENESS` — the snapshot spreads the raw recipients shape, so it does not
    carry the duplicate-recipient refinement that terms/prepared/submit enforce.
  - `R3-SOURCE-ACCOUNT-FORMAT` — `sourceAccountId` uses the loose trimmed-string shape instead of
    `stellarAccountIdSchema`.
- **Candidates B (backend S2a–S2e) and C (web S3) were not reviewed**: each needs its own consent and a
  reviewer run, and B is large enough that it may need further splitting under the same native budget.
  The maintainer accepted opening the PR with those two without a native receipt.

## Delivery evidence

- PR: [#345](https://github.com/reyduar/Vaqcrow/pull/345), `Closes #89`, targets `main` from
  `Vaqcrow#89_Task_Implement_Testnet_revenue_share_distribution`.
- Maintainer-approved `size:exception` (31 files, ~7300 changed lines).
- Engram mirror: this document is mirrored under `odd/implement-testnet-revenue-share-distribution/tasks`.

## Current next step

Task #90 (Feature #28 tests) is the natural home for the three `R3-` findings above, and should also
cover the multi-payment verifier and the confirmation backoff boundaries end to end.
