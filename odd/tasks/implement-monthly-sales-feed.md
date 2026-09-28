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
- After T3: 950
- Final (this closing log commit): 995 (0 deletions)

Note: the forecast was ~450-550 code lines; the count above also carries this log file (134 lines at
first commit plus the running evidence appended per unit), which is why it lands higher. Code+tests
only (excluding `odd/`): 710. The owner accepted `size:exception` for this single vertical
(D6), so the overage is reported, not shrunk — per the work-unit skill, the budget is not code-golf.
Commit convention: each unit's log update rode in that unit's commit; a commit cannot contain its own
hash, so each hash was recorded by the next commit, and this closing `docs(odd)` commit carries the
final verify evidence — it is the branch HEAD at hand-off.

## Tasks

- [x] T1 — `packages/contracts`: optional `provenance` on `salesPeriodSchema` + focused test (RED→GREEN) — commit `c04de71`
- [x] T2 — `apps/api` port `sales-data-provider-port.ts` + simulated adapter with frozen dataset (mirror fixture) + focused tests (RED→GREEN) — commit `8031302`
- [x] T3 — HTTP route (GET series, POST record-next, idempotent) + `buildApp` slice + `index.ts` wiring + route tests (RED→GREEN) — commit `b1fbac9`
- [ ] T4 — Full `pnpm run verify`, update log, work-unit commits complete; RDD review + PR (orchestrator)

Routes: T1-T3 delegated direct (writer trigger: 2+ non-trivial files, ~9 files); mapping delegated to
explore (4-file rule); this log authored inline by the orchestrator.

## Acceptance criteria (from issue #83)

- [x] Feature #26 behavior implemented within its documented boundary (next synthetic period loaded
      with provenance, known anomaly and explicit simulated labeling). — POST records frozen 2026-09
      with provenance + SIMULADO; June anomaly and April missing exposed unchanged (T2/T3 tests).
- [x] Periods, provenance, evidence references, the intentional anomaly and missing periods exposed
      through the replaceable provider with visible simulation labeling. — `SalesDataProviderPort`
      (plain data, replaceable at the composition root); every datum carries `simuladoLabel` and
      per-datum Spanish provenance (dataset tests pin both).
- [x] Failure paths truthful; domain/adapter boundaries preserved; no secrets, PII, user seeds or
      unsupported production claims. — typed `not_found`/`unavailable` → 404/503 sanitized codes only;
      `pnpm run boundaries` clean; dataset is fictional-bakery data, no seeds/keys/PII; SIMULADO on
      every datum, in-memory recording state documented as reset-on-restart (no production claim).
- [x] Focused checks pass; the ordered test Task (#84) can validate the slice. — 23 focused tests
      (11 adapter + 12 route) plus 4 contract tests; full `pnpm run verify` exit 0 (see below). #84
      hooks: dataset-drift cross-check against the web fixture (D4), suite-level determinism.

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
- 2026-09-28: T2 complete (commit `8031302`). Three new files in `apps/api`, no existing file touched:
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
- 2026-09-28: T3 complete (commit `b1fbac9`). HTTP surface + wiring:
  - `src/infrastructure/http/routes/sales-feed.route.ts` — `GET /businesses/:businessId/sales-periods`
    (200 `{ businessId, periods }`, 404 `{ code: "not_found" }`, 503 `{ code: "unavailable" }`) and
    `POST` on the same collection path to record the next period (201 `{ applied: true, period }`
    first call, 200 `{ applied: false, period }` on replay — the `applied ? 201 : 200` convention of
    `human-decision.route.ts`/`campaign.route.ts`). Endpoint shape follows the sub-resource convention
    of `/application-reviews/:applicationId/decisions`; no HTTP path is prescribed anywhere in
    docs/design or docs/planning (checked demo-ui.md and DEMO.md — only the provider interface at
    DEMO.md:250-253 is documented).
  - Exact-body-key validation on POST with an EMPTY allowed key set: which period comes next is the
    provider's decision, never the caller's, so a body carrying any key is refused 400 before the
    provider is called (same drifted-body-first convention as `assessment.route.ts`; the test proves
    the provider is not called via a stub). No body at all is also 400 — the exact key set is `{}`.
  - Error mapping leaks nothing: only the port's typed codes reach the wire; the simulated adapter has
    no internal detail to sanitize (no I/O), and the route adds none.
  - `build-app.ts` — optional `salesFeed?: SalesFeedRouteDependencies` slice, registered only when
    supplied (same pattern as `campaign`/`assessment`); route test pins the unregistered 404.
  - `index.ts` — `createSimulatedSalesDataProvider()` wired inline at the composition root. No
    `sales-feed-dependencies.ts` factory was created: the campaign factory exists to wire seven
    config-gated adapters; a single config-free simulated provider does not justify the indirection
    (writer brief: factory only "if that matches campaign-dependencies.ts style" — it does not).
  - Route tests parse every response period with `parseSalesPeriod` from `@vaqcrow/contracts`, so
    "payloads consistent with the shared contracts (including the new optional provenance)" is an
    assertion, not a comment.

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

### T3 — HTTP route + buildApp slice + composition-root wiring

- `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/http/routes/sales-feed.route.test.ts`
  (RED, route test authored first): 10 failed | 2 passed — `AssertionError: expected 404 to be 200`
  (route not registered; `buildApp` had no `salesFeed` slice). The 2 trivially-green guards: the
  correlation-id header (set by the global hook even on 404) and the unregistered-404 expectation.
- Same command (GREEN, after route + buildApp + index wiring): 12 tests passed (GET happy path with
  contract-parsed periods incl. April null/June anomalous, GET-after-POST shows 9 periods, GET 404
  unknown business, GET 503 sanitized unavailable, correlation id; POST 201 applied:true with
  contract-parsed 2026-09 period, replay 200 applied:false same period, extra-key body 400 with
  provider-not-called stub, no-body 400, POST 404, POST 503; unregistered slice 404).
- `pnpm --filter @vaqcrow/api typecheck`: exit 0, no output.
- `pnpm --filter @vaqcrow/api lint`: exit 0, no output.
- `pnpm --filter @vaqcrow/api test`: 39 files, 709 tests passed (full unit suite — the `buildApp`
  signature change regressed nothing).

### T4 (writer portion) — full branch verification, run at HEAD `b1fbac9`

- `pnpm run verify`: **exit 0**, first run, no flake retry needed. Stages:
  - `lint` (turbo): 5/5 successful — one PRE-EXISTING warning, not from this branch:
    `apps/web/src/infrastructure/http/fetch-http-client.ts:8 '_request' is defined but never used`
    (`git diff c87a327..HEAD -- apps/web` is empty — this branch touches no web file).
  - `typecheck` (turbo): 8/8 successful.
  - `lint:tests` + `typecheck:tests` (root `tests/`): clean.
  - `test` (turbo): 8/8 — contracts 9 files/329 tests, domain 1/60, ai 5/107, web 98/686,
    api 39/709. The web component suites (campaign-workspace, human-decision-form,
    sales-evidence-table, sme-request-workspace, layout.traversal) all passed first-run; the known
    environmental timeout flake class did not occur.
  - `build` (turbo): 5/5 — includes the Next.js production build with its own TypeScript pass over
    `apps/web`, which is the machine proof of the D1 ripple: the web strict parsers and
    `toAssessmentEvidence` compile and run against the widened contract untouched.
  - `boundaries` (depcruise): "no dependency violations found (444 modules, 1312 dependencies
    cruised)" — the new port (application/), adapter + dataset (infrastructure/) and route respect
    `api-application-stays-provider-free`, `contracts-never-import-node-core`,
    `contracts-never-import-frameworks` and `no-cross-app-imports`.
  - `test:boundaries` (root vitest): 8 files, 92 tests passed.
- The `[SupabaseApplicationReviewRepository] persistence error` stderr lines inside `@vaqcrow/api:test`
  are the pre-existing sanitization tests exercising their own console.error path — expected output,
  not failures.

## Next step

T4 (orchestrator): RDD review + PR. All writer work is complete: T1-T3 committed as work units
(`c04de71`, `8031302`, `b1fbac9`) plus this closing log commit; full `pnpm run verify` exit 0 at
HEAD; branch `Vaqcrow#83_Task_Implement_monthly_sales_feed` ready, unpushed. Delivery is one PR with
`size:exception` accepted by the owner (D6); the PR body can be written from this log. Suggested
review hooks: the dataset duplication comment in `simulated-sales-dataset.ts` (D4 drift risk → #84
cross-check) and the empty-body-key rule on the record-next POST.
