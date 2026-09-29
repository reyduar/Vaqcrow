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

## Current next step

T90-01 — confirm the merged base, then launch the bounded writer for the contract corrections.
