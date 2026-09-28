# Implement monthly sales feed

Iteration log for issue #83 (Task under Feature #26), branch
`Vaqcrow#83_Task_Implement_monthly_sales_feed`, base `c87a327` (main after PRs #330/#331).

## Objective

Expose synthetic monthly sales periods — provenance, evidence references, the intentional anomaly and
missing periods — through a replaceable sales-data provider in `apps/api`, with visible simulation
labeling, so Feature #26 can load the next synthetic sales period and unblock #27 (deterministic
revenue share) on the demo critical path (#83 → #86 → #89 → #95).

## Problem

`SalesDataProvider` exists only in planning docs (`docs/planning/DEMO.md:52`, `:250-253`;
`docs/planning/product.md:422`). No code in `apps/api` produces or serves sales periods; the historical
series 2026-01..08 (April missing, June anomalous) lives only in the web fixture
`apps/web/src/application/fixtures/panaderia-horizonte.ts`. The shared contract
`packages/contracts/src/sme-evidence.ts` `salesPeriodSchema` carries `period`, `amountArs`, `status`,
`evidenceRef`, `simuladoLabel` — but no provenance, so the web invents a neutral one
(`apps/web/src/application/evidence/review-mapper.ts:112-122`).

## Why

- Issue #83 functional requirement: expose periods, provenance, evidence references, the intentional
  anomaly and missing periods through the replaceable provider with visible simulation labeling.
- `docs/planning/DEMO.md:41` (story step 8: the feed records the next sales period with clearly
  labeled synthetic evidence), `:52` (matrix: simulated by `SalesDataProvider`, reproducible dataset,
  known sources and anomaly), `:70` (§5 minimum AI input: "Serie mensual de ventas con procedencia
  por dato" — provenance is per-datum).
- `docs/design/demo-ui.md:701-744` + `:1197` (Pantalla 6 `/demo/panel`: monthly feed adds the NEXT
  period, every value labeled SIMULADO; action "Cargar ventas simuladas"), `:522-563` (Pantalla 2:
  January–August 2026, missing April, June anomaly without asserting a cause).
- `docs/planning/demo-tasks-list.md:800` (#26: load the next synthetic period with provenance, known
  anomaly and explicit simulated labeling), `:815` (branch name).

## Scope

In: optional `provenance` on the shared `salesPeriodSchema`; `SalesDataProvider` port in
`apps/api/src/application/ports/`; simulated adapter + frozen dataset (9 periods: the 8 historical
mirroring the web fixture exactly + next period 2026-09) in `apps/api/src/infrastructure/adapters/`;
one HTTP route surface (read series + record next period) registered through `buildApp`'s
optional-dependency slice and wired in `apps/api/src/index.ts`; focused RED→GREEN tests per the
issue's testing strategy.

Out (belongs to #84/#85 or later features): the comprehensive deterministic test suite (#84), the
evidence document (#85), any `apps/web` change, `GET /sme-requests/current` (sme-request feature),
Supabase persistence, `packages/simulators` workspace creation, revenue-share calculation (#27).

## Decisions

- D1 — Provenance joins `salesPeriodSchema` as an OPTIONAL additive field. The issue requires
  exposing provenance and DEMO.md §5 makes it per-datum; the schema is strict, so any other shape
  (envelope metadata, separate feed schema) either breaks the published web parse or duplicates the
  period shape. Optional keeps `toAssessmentEvidence`'s 5-field projection, the
  `assessmentEvidenceBundleSchema` and the web strict parsers valid untouched. The provider ALWAYS
  populates it; optionality exists only for legacy consumers.
- D2 — No Supabase persistence. No planning doc requires a sales table; the established
  simulated-provider pattern is frozen data with no I/O and no clock
  (`packages/ai/src/simulated-assessment-provider.ts`, web fixture). Recording state is in-memory per
  process (restart resets the feed to "next period not yet recorded"), honest for a SIMULADO-labeled
  synthetic feed; no money fact depends on it.
- D3 — Port + adapter live in `apps/api`, NOT in a new `packages/simulators`. The package is planned
  (DEMO.md:144) but does not exist; creating a workspace for one provider is scope creep. Follow the
  assessment-provider pattern; move later if simulators materializes.
- D4 — Dataset mirrors `apps/web/src/application/fixtures/panaderia-horizonte.ts` values EXACTLY
  (amounts, statuses, evidenceRefs, April `amountArs: null` + `missing:2026-04`, June anomalous
  `sales:2026-06` without asserting a cause). Cross-app import is forbidden
  (`no-cross-app-imports`), so the dataset is duplicated with a comment naming the canonical fixture;
  drift risk recorded — #84 may add a cross-check.
- D5 — Next period is 2026-09, `status: "reported"`, frozen constant integer ARS amount consistent
  with the series, its own provenance and `evidenceRef` (`sales:2026-09`), `simuladoLabel: "SIMULADO"`.
  The June anomaly stays historical; the new period is not anomalous.
- D6 — Delivery: ONE PR with maintainer-accepted `size:exception` (owner chose it on 2026-09-28 over
  chained splits; the slice is one coherent vertical). Work-unit commits inside the branch.

## Constraints

- Boundaries (`.dependency-cruiser.cjs`): `apps/api/src/application/` never imports
  fastify/@fastify/@supabase/stellar/LLM SDKs except type-only; `packages/contracts/src` never
  imports Node core or Fastify; ports stay plain-data.
- Fail safely: typed result `{ ok: true, value } | { ok: false, error: { code } }` following the
  repository/assessment port patterns; unknown business → typed `not_found` → HTTP 404; unexpected
  internal failure → sanitized `unavailable` (log detail server-side only, never leak internals).
- Route conventions: exact-body-key validation (extra keys → 400) like `assessment.route.ts`;
  responses parse against the shared contracts.
- TypeScript gotchas current in this repo: `exactOptionalPropertyTypes` (conditional spreads),
  `noUncheckedIndexedAccess`.
- Language: identifiers, comments and this log in English; user-facing data VALUES in Spanish
  mirroring the existing fixture (e.g. provenance "Declaración mensual sintética", label "SIMULADO").
- No secrets, PII, user seeds or production claims; simulation labeled truthfully in every datum.
- TDD: strict (source: user global config "Strict TDD Mode: enabled" + issue #83 testing strategy).
  Runners: `pnpm --filter @vaqcrow/api exec vitest run <path>`;
  `pnpm --filter @vaqcrow/contracts test` (writer verifies the exact contracts runner).
- ~400 authored lines per task is advisory only.

## Delivery

Strategy: single PR, `size:exception` explicitly accepted by the owner (2026-09-28). Forecast ~450-550
authored changed lines (contract ~10, port ~40, dataset ~100, adapter ~70, route + wiring ~90, focused
tests ~190, log updates). Running count recorded per work unit below.

Running authored count (`git diff --stat c87a327..HEAD`, additions+deletions; includes the 134 lines of
this log file, which was untracked before the T1 commit):

- After T1: 197
- After T2: 630

## Tasks

- [x] T1 — `packages/contracts`: optional `provenance` on `salesPeriodSchema` + focused test (RED→GREEN) — commit `c04de71`
- [x] T2 — `apps/api` port `sales-data-provider-port.ts` + simulated adapter with frozen dataset (mirror fixture) + focused tests (RED→GREEN) — commit `T2HASH`
- [ ] T3 — HTTP route (GET series, POST record-next, idempotent) + `buildApp` slice + `index.ts` wiring + route tests (RED→GREEN)
- [ ] T4 — Full `pnpm run verify`, update log, work-unit commits complete; RDD review + PR (orchestrator)

Routes: T1-T3 delegated direct (writer trigger: 2+ non-trivial files, ~9 files); mapping delegated to
explore (4-file rule); this log authored inline by the orchestrator.

## Acceptance criteria (from issue #83)

- [ ] Feature #26 behavior implemented within its documented boundary (next synthetic period loaded
      with provenance, known anomaly and explicit simulated labeling).
- [ ] Periods, provenance, evidence references, the intentional anomaly and missing periods exposed
      through the replaceable provider with visible simulation labeling.
- [ ] Failure paths truthful; domain/adapter boundaries preserved; no secrets, PII, user seeds or
      unsupported production claims.
- [ ] Focused checks pass; the ordered test Task (#84) can validate the slice.

## Progress log

- 2026-09-28: branch created from `c87a327`; exploration map complete; delivery decision recorded
  (single PR, size:exception accepted by owner).
- 2026-09-28: T1 complete. `salesPeriodSchema` gains `provenance: z.string().min(1).optional()` between
  `status` and `evidenceRef` (field order mirrors the web fixture). Additive only — no other schema in
  `sme-evidence.ts` touched, `apps/web` untouched. D1 ripple analysis (by inspection now; machine proof
  is the final `pnpm run verify` build across consumers):
  - web `toAssessmentEvidence` (`apps/web/src/application/assessment/assessment-evidence.ts:18`) builds
    literal five-field objects — still assignable to `SalesPeriodContract` (the optional key is absent).
  - `assessmentEvidenceBundleSchema` (`packages/ai/src/assessment-evidence.ts:11`) embeds
    `salesPeriodSchema` — an optional field widens acceptance, narrows nothing.
  - web strict parser `http-sme-request-gateway.ts:24` parses with `salesPeriodSchema` — periods with
    or without `provenance` both parse; previously a `provenance` would have been rejected as an
    unrecognized key (this is exactly what the RED run observed).
  - web `backendPeriodsToEvidenced` (`review-mapper.ts:118-122`) spreads the contract period then sets
    `provenance: BACKEND_PROVENANCE` — the explicit key wins over the spread, so web behavior is
    unchanged even for periods that now carry a backend provenance. (Recorded for #84/#85: the web
    still overrides backend provenance with its neutral label; honoring it is a web-side decision out
    of #83 scope.)
- 2026-09-28: T2 complete (commit `T2HASH`). Three new files in `apps/api`, no existing file touched:
  - `src/application/ports/sales-data-provider-port.ts` — plain-data port (only import is the
    type-only `SalesPeriodContract`; `api-application-stays-provider-free` safe). Result shape
    `{ ok: true, value } | { ok: false, error: { code } }` with codes `not_found` | `unavailable`;
    `RecordedSalesPeriodOutcome.applied` mirrors `ApplicationReviewTransitionOutcome.applied` replay
    semantics. Methods follow DEMO.md §6 naming (`getPeriods(businessId)`) plus `recordNextPeriod`.
  - `src/infrastructure/adapters/simulated-sales-dataset.ts` — frozen constants: 8 historical periods
    duplicating `apps/web/src/application/fixtures/panaderia-horizonte.ts` values EXACTLY (D4 comment
    names the canonical fixture; fixture-only fields `label`/`note` deliberately do not cross the
    strict contract — June's "no cause asserted" is pinned in the adapter test by asserting the exact
    key set). `DEMO_BUSINESS_ID = "panaderia-horizonte"` (no identifier is established by
    `smeRequestSchema` or the fixture, so the slug is frozen per the writer brief). Next period 2026-09:
    `reported`, frozen `3_860_000` ARS (~3% over August's `3_745_800`, continuing the trend),
    `sales:2026-09`, provenance + SIMULADO like every datum (D5).
  - `src/infrastructure/adapters/simulated-sales-data-provider.ts` — factory in the
    `createSimulatedAssessmentProvider` style; in-memory per-process recording state (D2: restart
    resets the feed, honest for SIMULADO data, no money fact depends on it); `failWith: "unavailable"`
    option exists so route tests can exercise the sanitized failure path.
  Naming choices for #84/#85: provider serves `SalesPeriodContract` directly (the T1 optional
  `provenance` makes the contract type sufficient — no API-local period type needed).

## Verification evidence

### T1 — contracts optional provenance

- `pnpm --filter @vaqcrow/contracts exec vitest run src/sme-evidence.test.ts` (RED, before schema
  change): 1 failed | 28 passed — `parses a period carrying per-datum provenance and round-trips it`
  failed with `ZodError: unrecognized_keys ["provenance"]` ("Unrecognized key: \"provenance\"").
- `pnpm --filter @vaqcrow/contracts test` (GREEN): 9 files, 329 tests passed (4 new provenance tests:
  round-trip with provenance, parse without provenance, extra keys still rejected alongside a
  provenance, empty provenance rejected).
- `pnpm --filter @vaqcrow/contracts typecheck`: exit 0, no output.

### T2 — port + simulated adapter + frozen dataset

- `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/adapters/simulated-sales-data-provider.test.ts`
  (RED, test authored first): 1 file failed — `Failed to load url ./simulated-sales-dataset.js …
  Does the file exist?` (implementation modules did not exist yet).
- Same command (GREEN, after port + dataset + adapter): 11 tests passed (dataset: period order,
  April null-not-0, June anomalous with exact key set, SIMULADO + Spanish provenance on every datum,
  2026-09 frozen reported integer; provider: 8 periods before recording, not_found on both methods,
  record-once-then-replay `applied:false`, 9 periods after recording, per-instance state, failWith
  unavailable on both methods).
- `pnpm --filter @vaqcrow/contracts build`: exit 0 (refreshes `dist` so `apps/api` typechecks the new
  optional `provenance` against current declarations, not the stale pre-T1 build).
- `pnpm --filter @vaqcrow/api typecheck`: exit 0, no output.
- `pnpm --filter @vaqcrow/api lint`: exit 0, no output.

## Next step

Launch the delegated writer for T1-T3 with strict TDD and work-unit commits.
