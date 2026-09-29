# Implement deterministic revenue-share calculation

Iteration log for issue #86 (Task under Feature #27), branch
`Vaqcrow#86_Task_Implement_deterministic_revenue_share_calculation`, base `fba18c1`.

## Objective

Implement the deterministic revenue-share engine inside `@vaqcrow/domain` — integer minimum units, a
versioned rule, an explicit rounding policy, and balanced recipient allocations — so the LLM and the
network never compute an obligation.

## Problem

Feature #27 requires obligations calculated with minor units, versioned rules and explicit rounding.
Today `packages/domain` holds only the application-review lifecycle; nothing computes an obligation,
and the web's presentational `DistributionCalculation` takes pre-formatted strings and deliberately
performs no arithmetic (`odd/tasks/feedback-and-trust-components.md`). The calculation has no home yet.

## Why

`docs/planning/DEMO.md` §10 requires the calculation to use minimum units, a versioned rule and an
explicit rounding policy; `docs/design/demo-ui.md` §10.2 names the rule `RS-2026-01` and §8/§9 require
the panel to expose eligible sales, percentage, rule version, rounding, recipient allocations and a
balanced total. A pure, framework-free domain module is the correct boundary: it is testable off the
LLM, off Supabase and off Stellar, and it is what the later distribution Task (#89) will call.

## Scope

In: `packages/domain/src/revenue-share.ts` (types, rule constants, pure functions) and its focused
deterministic test file, plus the `packages/domain/src/index.ts` re-export; this iteration log.

Out: Fastify routes, Supabase persistence, Stellar/Horizon/Freighter, LLM provider calls, web
components, and any wire contract change in `@vaqcrow/contracts`. Those belong to later Tasks.

## Constraints

- `packages/domain/src` production code imports no npm dependency and stays framework-free
  (`.dependency-cruiser.cjs`); money is `bigint`, never a JS number, matching the stroop convention.
- Generated artifacts are in English. No secrets, PII, user seeds or unsupported production claims.
- Strict TDD: RED before GREEN before REFACTOR, with observed evidence recorded.
- Focused runner: `pnpm --filter @vaqcrow/domain exec vitest run <path>`.
- Delivery strategy: `ask-on-risk`; forecasts and the running count are tracked below.

## Acceptance criteria (verbatim from issue #86)

- Feature #27 behavior is implemented within its documented boundary.
- Calculate revenue-share obligations with integer minimal units, a versioned rule, explicit rounding,
  and balanced allocations; the LLM must not calculate or move funds.
- Failure paths remain truthful and do not weaken security or human-control boundaries.

## Design decisions

- **D1 — Rule version.** The canonical rule version is `RS-2026-01`, fixed by `docs/design/demo-ui.md`
  §10.2 and §11.4 ("Cálculo determinístico según regla RS-2026-01"). The rule is an explicit value, so a
  later version is a new value, never a silent behavior change.
- **D2 — Rate in basis points.** The contractual rate is an integer count of basis points (1 bp = 0.01 %),
  so `4.50 %` is `450` and no floating point ever touches money. The demo rule (`RS-2026-01`) is
  `450` bps, matching the `4,5 %` shown in `docs/design/demo-ui.md` §10.3.
- **D3 — Eligibility is hard and deterministic.** Only a period that is `reported` with a non-null amount
  is eligible. A `missing` period carries no amount; an `anomalous` period "Requiere revisión"
  (`docs/design/demo-ui.md` §8) and is excluded rather than silently billed. Excluded periods are
  returned with an explicit reason — never dropped — so the audit trail stays truthful.
- **D4 — Explicit rounding.** The rule names its rounding policy. `floor` (toward zero) is the demo
  default, so Vaqcrow never over-bills one minor unit; `half_up` is supported and named, not implicit.
- **D5 — Balanced allocations.** The obligation is split across contributors in proportion to their
  contributions using integer arithmetic; the residual units are assigned by the largest-remainder
  method, ties broken by contributor order. The allocations therefore always sum exactly to the
  obligation (balanced total), deterministically.
- **D6 — Pure result union.** Functions validate their inputs and return the repository's
  `{ ok: true, ... } | { ok: false, error }` shape with sanitized codes, never throwing across the
  boundary. The LLM is not referenced by any code path.

## Stable checklist

- [x] T86-01 — Confirm domain conventions, boundaries and staging (`packages/domain`).
- [x] T86-02 — RED: add the focused failing behavior test and record the observed failure.
- [x] T86-03 — GREEN: implement the smallest compliant revenue-share module and re-export it.
- [x] T86-04 — REFACTOR: preserve boundaries and rerun the deterministic checks.
- [x] T86-05 — Run focused checks and `pnpm run verify`.
- [x] T86-06 — Record proof, diff count, rollback boundary, Engram mirror and local work-unit commit.

## Planned checks

- Focused `@vaqcrow/domain` Vitest suite: eligibility, rate/rounding boundaries, balanced allocations,
  and each sanitized rejection path.
- `pnpm run verify` (lint, typecheck, tests, build, dependency boundaries).
- No Supabase integration suite, Stellar Testnet, Horizon, LLM provider or sensitive data.

## Route declaration

- T86-02/T86-03/T86-04 — delegated direct: one bounded writer, because the change spans 3 non-trivial
  files (module, test, index re-export) past the writer trigger. Context (rule, eligibility, rounding and
  allocation decisions) is fixed above and passed to the writer.
- T86-05/T86-06 — parent: focused checks, RDD assessment and the work-unit commit.

## Forecast and delivery

- Forecast: about 380–450 authored changed lines; actual authored source + tests = **858** (module 376,
  focused tests 457, `index.ts` re-export 25). The forecast under-counted the test matrix.
- Delivery strategy: `ask-on-risk` stopped before the commit as designed. The maintainer chose **a single
  PR with maintainer-approved `size:exception`**, because the module and its focused tests are one atomic
  work unit (splitting tests from behavior is forbidden) and even the production module alone is ~401
  lines with the re-export, so a code/tests chain would not reduce review load.

## Observed TDD evidence

### RED

- `pnpm --filter @vaqcrow/domain exec vitest run src/revenue-share.test.ts` failed as expected:
  `Error: Cannot find module './revenue-share.js' imported from .../revenue-share.test.ts`
  (`Failed to load url ./revenue-share.js`), `Test Files 1 failed (1)`, `no tests`. The behavior test
  existed before the module, so the missing engine is what failed.

### GREEN

- Implemented `packages/domain/src/revenue-share.ts` (types, `REVENUE_SHARE_RULE_VERSION` = `RS-2026-01`,
  `demoRevenueShareRule` = 450 bps floor, `calculateRevenueShareObligation`, `allocateRevenueShare`,
  `calculateRevenueShareDistribution`) and re-exported it from `index.ts`.
- `pnpm --filter @vaqcrow/domain exec vitest run src/revenue-share.test.ts`: **1 file, 34 tests passed.**
  The design example is pinned exactly: `2026-08` sales `3_745_800n` × 450 bps floor → `168_561n`.

### REFACTOR

- Extracted the shared `resolveAllocations()` used by both the standalone allocator and the composed
  distribution, removing a duplicated `no_contributors` branch with no observable change. Reran the
  focused suite: 34 passed.

## Verification evidence

- Focused suite: `pnpm --filter @vaqcrow/domain exec vitest run src/revenue-share.test.ts` — 34 passed.
- Domain package suite: `pnpm --filter @vaqcrow/domain test` — 94 passed (34 new + 60 existing).
- `pnpm --filter @vaqcrow/domain run typecheck` — exit 0.
- `pnpm --filter @vaqcrow/domain run lint` — exit 0.
- `pnpm run boundaries` — no dependency violations (470 modules, 1411 dependencies); the domain stays
  npm-free per `.dependency-cruiser.cjs`.
- `pnpm run verify` — the ordered full gate (lint, typecheck, tests, build, boundaries, boundary tests).
- No Supabase integration suite, Stellar Testnet, Horizon, LLM provider or sensitive data was used.

## Rollback boundary

Remove `packages/domain/src/revenue-share.ts` and `packages/domain/src/revenue-share.test.ts`, and revert
the `revenue-share.js` re-export block in `packages/domain/src/index.ts`. No other workspace, package,
route, migration or contract is touched. This log is the corresponding task record.

## Current next step

T86-06 — record the work-unit commit and its RDD assessment, then mirror this document to Engram.
