# Test monthly sales feed

Iteration log for issue #84 (Task under Feature #26), branch
`Vaqcrow#84_Task_Test_monthly_sales_feed`, base `166eca4`.

## Objective

Add deterministic, architecture-safe tests that prove the monthly sales feed's core behavior without
changing production code.

## Problem

Issue #83 implemented the simulated provider and HTTP surface, but #84 must independently demonstrate
the Feature #26 contract across success, validation/rejection, fallback, and the deliberate duplicated
fixture boundary.

## Why

The API dataset intentionally duplicates the web fixture because production cross-app imports are
forbidden. A test-only parity guard can detect drift without making either application a runtime
dependency of the other.

## Scope

In: deterministic API tests and an architecture-safe test-only parity cross-check when supported by
the repository test architecture; this iteration log.

Out: production behavior, contract changes, runtime cross-app imports, external services, sensitive
data, Supabase integration tests, Stellar Testnet, Horizon, and LLM-provider checks.

## Constraints

- The test deliverable must preserve April as `null` (never zero), pin the exact empty POST body rule,
  and preserve June as anomalous without asserting a cause.
- The API production layer must not import the web application; any parity guard remains test-only.
- TDD mode: strict, resolved from the authorized task protocol.
- Source runner: confirm `apps/api` package scripts before use; expected focused runner is
  `pnpm --filter @vaqcrow/api exec vitest run <path>`.
- Delivery strategy: `ask-on-risk`; stop before committing if the authored change forecast exceeds 400
  lines.
- Generated artifacts are in English.

## Acceptance criteria (verbatim from issue #84)

- deterministic tests demonstrate Feature #26 core behavior;
- validation, rejection, and applicable fallback behavior are covered;
- focused suite runs without live external services or sensitive data.

## Stable checklist

- [x] T84-01 — Confirm test architecture, scripts, and existing focused coverage.
- [x] T84-02 — RED: add one missing success, rejection, or fallback scenario and record the observed failure.
- [x] T84-03 — GREEN: make the deterministic scenario pass without production changes.
- [x] T84-04 — REFACTOR: remove test duplication while preserving observable assertions.
- [x] T84-05 — Run focused checks and `pnpm run verify`.
- [x] T84-06 — Record proof, diff count, rollback boundary, Engram mirror, and local work-unit commit.

## Planned checks

- Adapter and route focused Vitest suites, including unavailable fallback and malformed POST behavior.
- Test-only fixture parity guard for the historical API dataset and web fixture, if test boundaries permit.
- Full `pnpm run verify`; no live integration or external-provider tests.

## Current next step

The next work-unit commit must reassess against the same last reviewed boundary: `main`.

## Observed TDD evidence

### RED

- `pnpm exec vitest run tests/monthly-sales-feed-parity.test.ts` failed as expected after the test
  specified the missing test-only parity snapshot: `Cannot find module
  './monthly-sales-feed-parity.js'`. No tests ran because the deterministic cross-check harness did
  not yet exist.

### GREEN

- Added the root-test-only snapshot helper and parity assertion. The helper imports the API historical
  dataset and canonical web fixture only from `tests/`, outside the production dependency graph.
- `pnpm exec vitest run tests/monthly-sales-feed-parity.test.ts`: 1 file, 1 test passed.
- The parity assertion projects exactly the shared feed fields: period, amount, status, provenance,
  evidence reference, and `SIMULADO`. Therefore it detects historical-value drift while deliberately
  excluding the web-only `label` and `note` fields. April remains `null`, and June remains anomalous
  without moving a cause into the API datum.

### REFACTOR

- Replaced separate API/web projection functions with one structural projection helper, preserving the
  parity assertion unchanged.
- The first test-only typecheck exposed `exactOptionalPropertyTypes`: the contract's optional
  `provenance` can be present as `undefined`. The helper input was widened to model that existing
  contract shape; no production behavior changed.
- After the correction, `pnpm exec vitest run tests/monthly-sales-feed-parity.test.ts` passed (1/1) and
  `pnpm run typecheck:tests` exited 0.

## Verification evidence

- Focused deterministic suite:
  `pnpm exec vitest run tests/monthly-sales-feed-parity.test.ts` — 1 file, 1 test passed.
- Existing Feature #26 adapter/route proof:
  `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/adapters/simulated-sales-data-provider.test.ts src/infrastructure/http/routes/sales-feed.route.test.ts`
  — 2 files, 23 tests passed. This covers the frozen success path, 404 rejection, 503 unavailable
  fallback, POST idempotency, extra-key rejection before provider invocation, and no-body 400 behavior.
- `pnpm run typecheck:tests` — exit 0.
- No source-mutating normalization command is defined in root or API package scripts, so none was run.
- `pnpm run verify` — exit 0: lint, typecheck, root test lint/typecheck, workspace tests, build,
  dependency boundaries, and root boundary tests all passed. The only output warning is pre-existing:
  `apps/web/src/infrastructure/http/fetch-http-client.ts:8` `_request` unused.
- No Supabase integration suite, Stellar Testnet, Horizon, LLM-provider, live external service, or
  sensitive data was used.

## Rollback boundary

Remove `tests/monthly-sales-feed-parity.test.ts` and `tests/monthly-sales-feed-parity.ts`; no production
runtime module, contract, API route, or web fixture changes are involved. This log is the corresponding
task record.

## Delivery evidence

- Staged diff: 3 files, 175 additions, 0 deletions; below the 400-line `ask-on-risk` threshold.
- Work-unit commit: `5ded965 test(sales): add monthly feed parity guard`.
- Delivery PR: [#333](https://github.com/reyduar/Vaqcrow/pull/333),
  `test(sales): add deterministic monthly feed parity guard`, targets `main` from
  `Vaqcrow#84_Task_Test_monthly_sales_feed`.
- Board state: issue #84 is In review.
- Engram mirror: this full document is mirrored under `odd/test-monthly-sales-feed/tasks`.

## RDD and parent spot-check evidence

- RDD is enabled globally. The committed #84 candidate `5ded965` (base `main`) was assessed after its
  tests passed with `gentle-ai review assess --cwd /Users/arielduarte/Workspaces/Vaqcrow --agent opencode
  --base-ref main --committed-only --json`. The result schema was `gentle-ai.review-assessment/v1`:
  `risk: medium`, reason `executable_change` at `tests/monthly-sales-feed-parity.test.ts`, 3 changed
  paths, 188 changed lines, candidate kind `base-diff`, base ref `main`, and `review_due: false` with
  `review_due_reason: under_budget`.
- This medium-risk range is pending because `under_budget`; it is not approved, declined, or reviewed.
  The next work-unit commit must reassess against the same last reviewed boundary: `main`.
- Parent spot check after writer verification: `pnpm exec vitest run tests/monthly-sales-feed-parity.test.ts`
  reported 1 test file, 1 test passed, exit 0.
