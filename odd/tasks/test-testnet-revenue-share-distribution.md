# Test Testnet revenue-share distribution

Iteration log for issue #90 (Task under Feature #28), branch
`Vaqcrow#90_Task_Test_Testnet_revenue_share_distribution`, base `bd06df6` (merge of #345).

## Objective

Prove the distribution with deterministic tests that cover successful behavior, validation/rejection
boundaries and fallbacks — and close the three non-blocking findings the #89 review left for this Task.

## Problem

#89 shipped the distribution vertical with 184 focused tests, and the native review approved its contract
candidate with three findings that are real gaps: `terms` passes `null` as the source, so the authoritative
`submit` boundary accepts a recipient list containing the source account while `prepare` refuses it; the
snapshot spreads the raw recipients shape and so does not carry the duplicate-recipient refinement; and
`sourceAccountId` uses the loose trimmed-string shape instead of `stellarAccountIdSchema`. The Feature also
lacks an end-to-end deterministic sequence test (route + use cases + in-memory repository + Horizon double)
and explicit confirmation backoff boundary coverage.

## Why

`DEMO.md` §10/§11 require the distribution to fail safely and truthfully and the PR-gated suite to prove it
without Testnet, Horizon or a live provider. "Validation, rejection, and fallback behavior is covered"
cannot be claimed while the authoritative boundary accepts what the non-authoritative one rejects.

## Scope

In: the three contract corrections and their tests; an end-to-end deterministic distribution sequence test;
confirmation backoff/terminal boundary coverage; this log.

Out: runtime behavior beyond the three corrections, routes, migrations, the Soroban vault path, and the
Feature evidence (#91).

## Design decisions

- **D1 — The terms enforce the self-payment rule.** Since `terms` *does* carry `sourceAccountId`, its
  refinement must reject a recipient equal to the source, so `submit` — the authoritative boundary —
  cannot accept what `prepare` refuses. The stale rationale claiming otherwise is removed.
- **D2 — The snapshot reuses the terms shape.** The read model must not be laxer than the write model:
  duplicate recipients are refused there too.
- **D3 — `sourceAccountId` is a Stellar public key.** It uses `stellarAccountIdSchema`, like every recipient.
- **D4 — One sequence test proves the wiring.** Route + real use cases + in-memory PostgREST double +
  Horizon double, with success, rejection, replay and fallback, mirroring `confirmation-sequence.test.ts`.
- **D5 — Behaviour for valid inputs is frozen.** The 184 #89 tests keep passing unchanged.

## Stable checklist

- [ ] T90-01 — Confirm the merged engine, the three findings and the test runner.
- [ ] T90-02 — RED: add the contract corrections' failing tests and the sequence/backoff scenarios.
- [ ] T90-03 — GREEN: apply the minimal contract hardening until the suite passes.
- [ ] T90-04 — REFACTOR: remove duplication while preserving observable assertions.
- [ ] T90-05 — Run focused checks and `pnpm run verify`.
- [ ] T90-06 — Record proof, rollback boundary, Engram mirror and the work-unit commit.

## Constraints

- Strict TDD. No Testnet/Horizon/Freighter/LLM in gated tests; real signed envelopes with throwaway keypairs
  and hand-declared doubles only.
- `apps/api/src/application/**` stays provider-SDK-free; contracts stay Node-free.
- Delivery strategy: `ask-on-risk`; `size:exception` already approved for this Feature.

## Route declaration

- T90-02/T90-03/T90-04 — delegated direct: one bounded writer per slice.
- T90-05/T90-06 — parent: checks, RDD and the commit.

## Observed TDD evidence

### S1 — contract hardening (`65f3a00`)

- RED: 13 failed / 130 passed. Every new case failed for the right reason: terms accepted a recipient equal
  to the source, the snapshot accepted duplicate recipients and a self-paying list, and `sourceAccountId`
  accepted a contract address, a non-account string and a padded key.
- GREEN: the terms refinement now passes `value.sourceAccountId` (so `submit`, which reuses the terms,
  refuses self-payment too); the snapshot calls the same recipient check; `sourceAccountId` uses
  `stellarAccountIdSchema`. 143 tests pass.
- REFACTOR: narrowed the recipient check's source parameter from `string | null` to `string` once the `null`
  caller disappeared. No app fixture needed changing — every distribution `sourceAccountId` fixture already
  used a valid `G…` key.

### S2 — end-to-end sequence and backoff boundaries (`revenue-share-distribution-sequence.test.ts`)

- RED: 6 of 7 new sequence tests failed with `TypeError: Do not know how to serialize a BigInt` — the test
  typed its submit body as the contract's bigint terms instead of the decimal-string wire shape. Production
  was correct; the test's wire shape was wrong.
- GREEN: the sequence now runs prepare → signed submit (202, parent + recipients persisted) → exact replay
  (200, no duplicate rows) → a mismatched envelope (422, repository left empty) → `runOnce` to `confirmed`,
  to `failed` with a sanitized reason, and to a truthful `submitted` when the port is unavailable and then
  resumes on the next due tick.
- Extended `confirm-revenue-share-distributions.test.ts` with the backoff evolution to its clamp, a record
  past its time bound earning no further attempt, and a two-tick defer that still confirms late.

## Verification evidence

- `pnpm --filter @vaqcrow/contracts test` — 487 passed (distribution contract 143).
- `pnpm --filter @vaqcrow/api test` — 944 passed (the sequence suite and the confirmation use case included).
- `pnpm --filter @vaqcrow/contracts run typecheck` / `run lint`, `pnpm --filter @vaqcrow/api run typecheck` /
  `run lint` — exit 0.
- `pnpm run boundaries` — no dependency violations (498 modules, 1561 dependencies).
- `pnpm run verify` — the ordered full gate (lint, typecheck, tests, build, boundaries, boundary tests).
- No Supabase integration suite, Stellar Testnet, Horizon, Freighter or LLM provider was used; the only
  wall-clock reads are inside the real production adapters, with injected clocks driving all scheduling.

## Rollback boundary

Revert `packages/contracts/src/revenue-share-distribution.ts` and its test to the #89 state, and remove
`apps/api/src/infrastructure/http/revenue-share-distribution-sequence.test.ts` plus the added confirmation
cases. No runtime behaviour beyond the three contract corrections is involved.

## Review evidence

- RDD is enabled globally. `gentle-ai review assess --base-ref bd06df6 --committed-only` reported `medium`
  risk, `review_due: true`, `slice_budget_reached` (1108 changed lines).
- The preflight returned a `gentle-ai.review-integration.consent/v3` envelope (6 files, 1108 lines); it was
  relayed losslessly and the maintainer granted consent.
- `review.start` created lineage `review-3698a531f6bf010e` with one consolidated lens,
  `review-reliability`. The provider-bound reviewer produced an **approved** result.
- One non-blocking `WARNING` is recorded as later work: `R3-read-model-strictness` — the snapshot now
  rejects a recipient equal to the source, but a row written under the laxer #89 terms schema could fail
  snapshot parsing on read. In practice `prepare` always refused self-payment and the envelope verification
  binds the recipients, so no such row can be produced by the demo flow; a defensive read-path
  reconciliation remains a follow-up rather than a blocker.
- Authority was burned with the exact `review.acknowledge-approved` invocation (`authority: "burned"`).
- The reviewer Task returned `opencode_task_output_empty` once before succeeding; the same bound slot was
  relaunched after a fresh STATUS reoffered it.

## Delivery evidence

- Work units: `65f3a00 fix(contracts): enforce distribution source and recipient rules`,
  `19bfc0f test(stellar): prove distribution sequence and confirmation boundaries`.
- PR: drafted against `main` from
  `Vaqcrow#90_Task_Test_Testnet_revenue_share_distribution`.
- Engram mirror: this document is mirrored under `odd/test-testnet-revenue-share-distribution/tasks`.

## Current next step

Task #91 (Feature #28 evidence) closes Feature #28 and should fold in the `R3-read-model-strictness`
follow-up.
