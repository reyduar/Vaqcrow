# Test deterministic revenue-share calculation

Iteration log for issue #87 (Task under Feature #27), branch
`Vaqcrow#87_Task_Test_deterministic_revenue_share_calculation`, base `192b5c1` (merge of #341).

## Objective

Prove the deterministic revenue-share engine with a deterministic test matrix that covers success,
validation/rejection boundaries, and the balanced-allocation invariant — closing the three
`informational` advisories the #86 review left for this Task.

## Problem

#86 shipped the engine and 34 focused tests, and the native review approved it with three non-blocking
advisories: `allocateRevenueShare` never validates `obligationMinorUnits` (a negative obligation returns a
success whose allocations do not sum to the obligation); `validatePeriods` accepts a negative
`salesMinorUnits`, which later surfaces as the misleading `invalid_contributor`; and the exported policy
arrays are mutable at runtime. The acceptance criterion "Validation, rejection, and fallback behavior is
covered" cannot be met truthfully while those paths are unproved or untruthful.

## Why

Feature #27 requires the calculation to fail safely and truthfully (`DEMO.md` §10: "El cálculo de revenue
share usa unidades mínimas, regla versionada y política explícita de redondeo"; `product.md` §12:
"Reglas determinísticas controlan ... montos, redondeos"). The three advisories are exactly the boundary
cases where that promise is currently unproved. This Task proves them, and adds the smallest production
hardening each new test requires.

## Scope

In: the deterministic test matrix for `revenue-share.ts`, and the minimal production hardening the tests
require (validate a non-negative `bigint` `obligationMinorUnits`; reject a negative reported
`salesMinorUnits`; freeze the exported policy arrays); this iteration log.

Out: Fastify routes, Supabase, Stellar/Horizon/Freighter, LLM, web components, `@vaqcrow/contracts` wire
changes, and any behavioral change to valid inputs (the #86 success path and its pinned values stay
identical).

## Constraints

- `packages/domain/src` stays npm-free and framework-free; money stays `bigint`.
- Strict TDD: the new boundary tests fail first, then the minimal hardening makes them pass.
- Focused runner: `pnpm --filter @vaqcrow/domain exec vitest run <path>`.
- Generated artifacts are in English. No secrets, PII, user seeds or unsupported production claims.
- Delivery strategy: `ask-on-risk` (the Feature already carries a maintainer-approved `size:exception`
  for its PRs).

## Acceptance criteria (verbatim from issue #87)

- Deterministic tests demonstrate the core behavior of Feature #27.
- Validation, rejection, and fallback behavior is covered where applicable.
- The focused suite passes without live external services or sensitive data.

## Design decisions

- **D1 — Truthful negative-obligation rejection.** A negative `obligationMinorUnits` is invalid input, not
  a calculation to balance. A new sanitized code `invalid_obligation` is returned instead of a success
  whose allocations silently do not sum to the obligation. The code is additive to the public union.
- **D2 — Negative sales are rejected, not summed.** A `reported` period whose `salesMinorUnits` is a
  negative `bigint` is malformed → `invalid_period`, so the composed distribution never reaches the
  balance guard and never reports the misleading `invalid_contributor`.
- **D3 — Frozen exported policy vocabulary.** `revenueShareRoundingPolicies` and
  `revenueSharePeriodStatuses` are frozen, so a consumer cannot mutate the vocabulary that validation and
  rounding branch on.
- **D4 — Invariant, not example-only.** New tests assert the balanced-total invariant and determinism
  across a deterministic matrix of obligations and contribution sets, plus precision beyond
  `Number.MAX_SAFE_INTEGER` and the `.5` rounding boundary, instead of single hand-picked examples.
- **D5 — Valid-input behavior is frozen.** Every #86 assertion and pinned value (`3_745_800n × 450 bps
  floor = 168_561n`, `34/33/33`, `floor` vs `half_up`) must keep passing unchanged.

## Stable checklist

- [x] T87-01 — Confirm the merged engine, the three advisories, and the test runner.
- [x] T87-02 — RED: add the new boundary/validation/invariant tests and record their failures.
- [x] T87-03 — GREEN: apply the minimal hardening (D1–D3) until the suite passes.
- [x] T87-04 — REFACTOR: preserve boundaries and rerun the deterministic checks.
- [x] T87-05 — Run focused checks and `pnpm run verify`.
- [x] T87-06 — Record proof, diff count, rollback boundary, Engram mirror and local work-unit commit.

## Planned checks

- Focused `@vaqcrow/domain` suite: the existing 34 tests plus the new boundary matrix.
- `pnpm run verify` (lint, typecheck, tests, build, dependency boundaries).
- No Supabase integration suite, Stellar Testnet, Horizon, LLM provider or sensitive data.

## Route declaration

- T87-02/T87-03/T87-04 — delegated direct: one bounded writer; the change spans 2–3 files past the writer
  trigger, and the decisions above are fixed and passed to it.
- T87-05/T87-06 — parent: focused checks, RDD assessment and the work-unit commit.

## Observed TDD evidence

### RED

New tests added to `packages/domain/src/revenue-share.test.ts` first; `pnpm --filter @vaqcrow/domain exec
vitest run src/revenue-share.test.ts` reported `6 failed | 54 passed (60)`. All six are the advisory
cases, nothing else:

1. negative obligation with contributors → returned an unbalanced success, not `invalid_obligation`;
2. negative obligation with no contributors → returned `ok` `[]`, not `invalid_obligation`;
3. non-`bigint` obligation cast at runtime → **threw** `TypeError` (number × bigint in
   `buildAllocations`), proving the "never throws" promise was violated on malformed input;
4. negative reported sales → returned `ok` (obligation `0n`), not `invalid_period`;
5. negative reported sales through `calculateRevenueShareDistribution` → returned `ok`, not
   `invalid_period`;
6. `Object.isFrozen` on both exported vocabulary arrays → `false`.

The other 20 new tests passed before any production change: balanced-total matrix, determinism,
largest-remainder tie-break, status-wins-over-amount, precision beyond `2^53`, the `.5` boundary, unknown
status, `NaN`/`Infinity` rate, whitespace contributor ids, empty periods and zero distribution. The core
was already correct; only the advisory paths were unproved or untruthful.

### GREEN

Applied D1–D3 in `packages/domain/src/revenue-share.ts` only (**+14 / −6**, exactly the minimal hardening):

- D1 added `"invalid_obligation"` to `RevenueShareErrorCode`; `resolveAllocations` now checks
  `typeof obligationMinorUnits !== "bigint" || obligationMinorUnits < 0n` **before** the
  `no_contributors` guard.
- D2 `validatePeriods` now requires a non-negative `bigint` reported amount (the `typeof` check
  short-circuits before the comparison, so the malformed-input throw is gone).
- D3 `Object.freeze([...] as const)` on both exported arrays, with `readonly` tuple types preserved.

Result: **60/60 pass**. No #86 pinned value changed (`3_745_800n → 168_561n`, `34/33/33`, `floor` vs
`half_up` all still assert).

### REFACTOR

Hoisted the duplicated malformed-period literals inside the new sales describe block; assertions
unchanged. Rerun: 60/60 pass.

## Verification evidence

- `pnpm --filter @vaqcrow/domain exec vitest run src/revenue-share.test.ts` — 1 file, **60 passed**.
- `pnpm --filter @vaqcrow/domain test` — 2 files, **120 passed** (60 revenue-share + 60 application-review).
- `pnpm --filter @vaqcrow/domain run typecheck` — exit 0.
- `pnpm --filter @vaqcrow/domain run lint` — exit 0.
- `pnpm run boundaries` — no dependency violations (470 modules, 1411 dependencies).
- `pnpm run verify` — the ordered full gate (lint, typecheck, tests, build, boundaries, boundary tests).
- No Supabase integration suite, Stellar Testnet, Horizon, LLM provider or sensitive data was used.

## Rollback boundary

Revert `packages/domain/src/revenue-share.ts` to its #86 state and remove the new (#87) describe
block from `packages/domain/src/revenue-share.test.ts`. The #86 assertions and production behavior for
valid inputs are untouched, so the rollback restores exactly the merged engine. This log is the
corresponding task record.

## Current next step

T87-06 — commit the work unit, assess it with RDD and mirror this document to Engram.
