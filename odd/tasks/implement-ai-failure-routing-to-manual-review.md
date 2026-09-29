# Implement AI failure routing to manual review

Iteration log for GitHub Task #71 under Feature #22. Branch:
`Vaqcrow#71_Task_Implement_AI_failure_routing_to_manual_review`.

## Objective

Route a failed AI assessment to truthful, persisted human review within the demo boundary. A timeout,
invalid provider output, unknown evidence reference, or provider-unavailable result must never become an
approval or a fabricated recommendation.

## Problem / why

`@vaqcrow/ai` already collapses assessment failures to typed, sanitized outcomes, and the assessment
HTTP route reports them without returning an assessment. It intentionally stops there: Feature #22 owns
the missing handoff from `awaiting_assessment` to `human_review`. The existing human-review experience
also contains a disconnected simulated recommendation for this path, so it cannot truthfully explain a
persisted manual-review fallback.

This task starts Feature #22 and unblocks deterministic validation in Task #72. The planning source is
[[docs/planning/demo-tasks-list#^issue-22|Feature #22]] and
[[docs/planning/demo-tasks-list#^issue-71|Task #71]].

## Authorized scope

In scope:

- A durable, sanitized assessment-attempt/failure handoff at the persistence and repository boundary.
- Application-scoped API routing from `awaiting_assessment` to `human_review`.
- A human-review UI that renders persisted manual-review context truthfully for this failure flow.

Out of scope:

- Any approval path, automatic decision, obligation calculation, or fund movement.
- A real LLM provider, provider SDK, credential, raw provider payload, or vendor-specific error.
- The deterministic test Task #72, the Feature evidence Task #73, and unrelated UI or API changes.

## Constraints

- AI remains advisory only. A failure routes to a person; it never approves, rejects, or calculates an
  obligation.
- Raw provider errors and raw provider output must never persist or cross application, repository, HTTP,
  or UI boundaries. Only a stable, sanitized failure code and explicitly approved display context may
  travel.
- Preserve the enforced layering: application code depends on ports, infrastructure owns Supabase and
  Fastify details, and the web consumes contracts rather than backend domain code.
- State changes must be conditional and replay-safe. Repeating the same failure handoff is a replay;
  incompatible correlation or state is a conflict, not another transition.
- No remote services, credentials, production claims, PII, or simulated data presented as real.
- TDD status: **active**. Focused runners:
  - AI-71-01 (RED observed 2026-09-28, GREEN after implementation):
    `pnpm --filter @vaqcrow/contracts exec vitest run src/assessment-failure-handoff.test.ts` and
    `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/adapters/supabase-application-review-repository.test.ts`.
  - AI-71-02 (RED observed 2026-09-28, GREEN after implementation):
    `pnpm --filter @vaqcrow/api exec vitest run src/application/use-cases/route-assessment-failure-to-manual-review.test.ts src/infrastructure/http/routes/application-assessment.route.test.ts`.
  - AI-71-02 correction (RED observed 2026-09-28, GREEN after implementation):
    the same focused API runner plus
    `pnpm --filter @vaqcrow/contracts exec vitest run src/assessment-handoff-id.test.ts`.

## Delivery strategy

`ask-on-risk`. The implementation route is delegated because this is multi-file work spanning persistence,
repository/application routing, and web presentation. Keep each stable-ID unit independently reviewable;
ask before a size or coupling risk requires a chained slice or a scope expansion.

## Actionable checklist

- [x] **AI-71-01 — Durable sanitized failure handoff.** Loaded the `supabase`,
      `supabase-postgres-best-practices` and `work-unit-commits` skills. Implemented the sanitized
      attempt/failure record, the atomic migration and the repository-port/adapter boundary, and proved
      raw provider errors/output cannot persist or cross it. **Implemented, locally verified, and applied
      to the configured remote project under explicit operator authorization (2026-09-28).** Committed on
      this branch as `3fad6a0` (contract) → `d1281ee` (repository/port) → `fcebf1f` (migration + pgTAP) →
      `568f5d7` (this iteration log). The earlier "still left uncommitted" notes in Progress describe the
      pre-commit state and are superseded (see Progress → Commit reconciliation).
- [x] **AI-71-02 — Application-scoped fallback route.** Added
      `apps/api/src/application/use-cases/route-assessment-failure-to-manual-review.ts` (persist-then-
      transition orchestration over the existing `runAssessment`) and
      `apps/api/src/infrastructure/http/routes/application-assessment.route.ts`
      (`POST /application-reviews/:applicationId/assessments`), wired through `build-app.ts` and the
      composition root. Truthful replay/conflict/not-found semantics, correlation identity preserved, no
      approval path. **Implemented, TDD RED→GREEN observed, locally verified; committed as `8f0f196`**
      (`feat(review): route failed AI assessments to truthful manual review`, 6 files, 936 insertions).
      **Corrected after independent verification as `9478052`** (`fix(review): make AI failure routing
      truthful and replayable`, 7 files, 337 insertions / 45 deletions); see Progress → AI-71-02
      correction (D1–D4).
- [x] **AI-71-03 — Truthful human-review context.** Connected the human-review UI to persisted
      manual-review context for this flow. Removed the disconnected simulated recommendation only for
      this failure flow (it remains for the unrelated flow where no handoff exists). Loaded the
      `work-unit-commits` and `frontend-design` skills; the panel reuses the existing HeroUI `Badge`
      primitive, so no other skill was needed. **Implemented, TDD RED→GREEN observed, locally verified;
      committed as `c4db07d`** (`feat(review): read persisted manual-review context for the AI failure
      flow`, 22 files, 1047 insertions / 18 deletions); see Progress → AI-71-03.

## Acceptance criteria

- A timeout, invalid output, unknown evidence reference, or provider-unavailable outcome creates a durable,
  sanitized manual-review handoff without persisting or exposing raw provider errors/output.
- The only fallback transition is `awaiting_assessment` → `human_review`; retries are replay-safe and
  incompatible state/correlation attempts return explicit conflicts.
- No API, persistence, or UI path treats a failed AI assessment as approval, rejection, or an obligation
  calculation.
- The human-review view displays persisted manual-review context and does not show its disconnected
  simulated recommendation for this failure flow.
- Focused checks and the repository verification gate pass before this implementation is considered ready
  for Task #72.

## Verification plan

1. Confirm the focused API Vitest configuration, then write a RED test for each stable-ID behavior before
   implementation.
2. Verify migration semantics locally with the repository's approved local database workflow; verify RLS,
   grants, conditional transition, replay, and conflict behavior without raw-error persistence.
3. Run focused repository/use-case/route/UI tests and prove sanitization at every boundary.
4. Run `pnpm run boundaries` and the applicable typecheck/lint commands; run `pnpm run verify` at the
   integration boundary when the implementation slice is complete.
5. Record exact commands, results, runtime-harness status, and rollback boundaries in this log as work
   proceeds. Task #72 owns the comprehensive deterministic matrix.

## Progress

- 2026-09-28: initialized locally from `main`; no application source, tests, migrations, or external
  documentation changed.
- 2026-09-28: verified the planning dependency (#21 → #22 → #71) and the existing boundaries: the AI
  package emits typed sanitized failures; the assessment route reports them and explicitly defers manual
  routing to Feature #22; application-review persistence already exposes conditional state transition
  patterns.
- 2026-09-28: reconciled the partial work left by the previous writer. Kept the two RED tests as
  expressing the intended behavior, then extended them with the missing closed-set, optional-provenance,
  replay, `not_found` and `state_conflict` cases **before** writing any implementation.

### AI-71-01 — durable sanitized failure handoff (implemented, locally verified, committed)

Deliverables:

- `packages/contracts/src/assessment-failure-handoff.ts` — strict zod schema and
  `parseAssessmentFailureHandoffCommand`. Rejects, as unknown keys at every level: raw provider output,
  vendor errors, secrets, PII, seeds and arbitrary provenance metadata. Closed failure-code set
  `timeout | provider_unavailable | invalid_output | unknown_evidence_reference`. `providerProvenance` is
  optional and strictly shaped on the AI metadata vocabulary; the evidence bundle mirrors the validated
  synthetic series/findings vocabulary over the shared `@vaqcrow/contracts` schemas (contracts cannot
  import `@vaqcrow/ai` — that dependency already runs the other way).
- `packages/contracts/src/index.ts` — exports the new schemas, parser and types.
- `apps/api/src/application/ports/application-review-repository-port.ts` — adds the sanitized
  `correlation_conflict` error code, `AssessmentFailureHandoffRepositoryOutcome` and
  `recordAssessmentFailureHandoff`. The port imports only contract types — no Fastify/Supabase/LLM SDK.
- `apps/api/src/infrastructure/adapters/supabase-application-review-repository.ts` — adapter method calling
  the atomic RPC and re-validating the returned row through the contract parser; maps `applied`,
  `replayed`, `not_found`, `state_conflict` (with `actualState`) and `correlation_conflict`; never returns
  provider diagnostics.
- `supabase/migrations/20260928235908_create_assessment_failure_handoff.sql` — table + RLS + explicit
  grants + atomic RPC, following the `record_human_decision` pattern exactly (no default
  anon/authenticated grant, `security invoker`, empty `search_path`, advisory lock, `revoke execute` /
  `grant execute`). Renamed from `20260928120000_…` to the version the remote recorded on apply (see
  Progress → Remote application).
- `supabase/tests/assessment_failure_handoff.sql` — 20-assertion pgTAP proof.
- Test doubles updated for the widened port: `open-campaign.test.ts`, `record-human-decision.test.ts`,
  `human-decision.route.test.ts`.

RED evidence (before implementation, 2026-09-28):

- `pnpm --filter @vaqcrow/contracts exec vitest run src/assessment-failure-handoff.test.ts` →
  `FAIL ... Cannot find module './assessment-failure-handoff.js'`, `Test Files 1 failed (1)`, `Tests no tests`.
- `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/adapters/supabase-application-review-repository.test.ts`
  → `TypeError: (0 , parseAssessmentFailureHandoffCommand) is not a function`, `Tests no tests`.

GREEN evidence (after implementation, 2026-09-28):

- `pnpm --filter @vaqcrow/contracts exec vitest run src/assessment-failure-handoff.test.ts` → 1 file, 4 tests passed.
- `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/adapters/supabase-application-review-repository.test.ts`
  → 1 file, 32 tests passed.
- `pnpm --filter @vaqcrow/contracts test` → 10 files, 333 tests passed.
- `pnpm --filter @vaqcrow/api test` → 39 files, 714 tests passed.
- `pnpm --filter @vaqcrow/contracts typecheck` and `pnpm --filter @vaqcrow/api typecheck` → exit 0.
- `pnpm --filter @vaqcrow/contracts lint` and `pnpm --filter @vaqcrow/api lint` → exit 0.
- `pnpm run boundaries` → `no dependency violations found (446 modules, 1320 dependencies cruised)`.
- `git diff --check` → clean.

Local database status:

- Local docker profile healthy. `supabase migration up --local` applied
  `20260924132528_add_campaign_sme_account.sql` (pre-existing drift: never applied locally) and
  `20260928120000_create_assessment_failure_handoff.sql` (since renamed to `20260928235908_…` after the
  remote apply — see Progress → Remote application). `supabase migration list --local` now shows both
  applied.
- `pnpm run test:db` → `All tests successful. Files=2, Tests=41` (20 new handoff assertions + 21 campaign
  assertions). Proves: table + RLS, anon/authenticated denied while service_role is granted, `anon` cannot
  execute the command, no column exists for raw provider diagnostics, the closed-code and evidence-shape
  CHECK constraints, and the `applied` / `replayed` (stored canonical values, not the resubmitted payload) /
  `correlation_conflict` / `not_found` / `state_conflict:approved` outcomes plus the FK `ON DELETE CASCADE`.
- Live integration against the local docker profile: `human-decision-persistence` (8 tests) and
  `application-review-persistence` (7 tests) passed — the suites this change could affect. The
  `funding-intent-persistence` file fails with `PGRST205`/404 because the local DB retired `funding_intent`
  at `20260923183356` (it is `funding_intent_legacy`); that failure pre-exists this task and is unrelated.
- No remote Supabase project, credential, hosted service, Stellar Testnet, Horizon or LLM provider was used.

Remote application (2026-09-28, explicit operator authorization; remote-only work):

Destination confirmed before mutating as the single configured remote project `ppvlnwejajxpsmazvnbj`
(`opencode.json` + `.mcp.json` MCP URL, `docs/architecture/deploy-planning.md`, and a live
`get_project_url` → `https://ppvlnwejajxpsmazvnbj.supabase.co`). Applied through the Supabase MCP
(`apply_migration`), the repository's documented remote path (`campaign-vault-web-journey.md` U2). The
Supabase CLI is not authenticated here, so it could not be used: `supabase projects list` →
`Access token not provided. Supply an access token by running 'supabase login' or setting the
SUPABASE_ACCESS_TOKEN environment variable.`; `supabase migration list --linked` →
`Cannot find project ref. Have you run supabase link?`.

Correction to the earlier blocker: the remote was **not** missing both migrations. Read back directly:
`20260924132528_add_campaign_sme_account` was already present — both in the history (version
`20260924132528`, name `add_campaign_sme_account`) and in the schema (`public.campaign.sme_account_id`,
`NOT NULL`, CHECK `sme_account_id ~ '^G[A-Z2-7]{55}$'`; RLS enabled; grants limited to `service_role`
INSERT/SELECT/UPDATE, none for `anon`/`authenticated`). It was **verified, not re-applied** (a second
`apply_migration` would only duplicate the history entry). Only the handoff migration was pending.

Handoff migration — applied and verified:

- Command: `apply_migration(name=create_assessment_failure_handoff, query=<file body>)` →
  `{"success": true}`. The Management API recorded version **`20260928235908`** (apply-time UTC). The
  version is generated server-side and cannot be chosen via the MCP — confirmed in the MCP source:
  `apply_migration` forwards only `{name, query}` to `POST /v1/projects/{ref}/database/migrations`.
- Per the U2 procedure the repo file was renamed `20260928120000` → `20260928235908` so the repository
  and the remote history agree without writing to `supabase_migrations`.
- Verification (read-only SQL via MCP `execute_sql`): table `public.assessment_failure_handoff` exists;
  RLS enabled with **zero** policies; `anon`/`authenticated` hold no table privilege and no EXECUTE while
  `service_role` holds SELECT/INSERT and EXECUTE; the FK references `application_review` `ON DELETE
  CASCADE`; the three CHECK constraints are present (closed code set `timeout | provider_unavailable |
  invalid_output | unknown_evidence_reference`, evidence-shape, provenance-shape); and no
  `message`/`details`/`raw_output`/`error`/`stack` column exists. The RPC is `security invoker`,
  `search_path = ''`, and its `applied` branch returns `null::text` exactly as the file does.
- Deviation found and corrected: the first `apply_migration` call transcribed the `applied` branch's final
  value as `v_actual_state` instead of the file's `null::text`. Diffing `pg_get_functiondef` against the
  file caught it; it was corrected in place with `create or replace function …` at the same signature (no
  second history entry) and re-verified.
- Migration-history lines read back from the remote (MCP `list_migrations`):

  ```
  20260923183356  create_campaign_persistence
  20260924132528  add_campaign_sme_account
  20260928235908  create_assessment_failure_handoff
  ```

  (The seven earlier entries keep the versions they were originally recorded under; that pre-existing
  drift is untouched.)

Caveat (local, not remote): the local docker database still records the handoff at `20260928120000`,
because it was applied locally before this remote-first rename. `env:docker:up` does not run migrations,
so the local bootstrap is unaffected; a fresh local stack records `20260928235908`, while the existing
local DB would need a local reconcile before another `migration up --local`.

Remaining state of AI-71-01: applied and verified on the configured remote; **committed** on this branch
(`3fad6a0` contract, `d1281ee` repository/port, `fcebf1f` migration + pgTAP, `568f5d7` iteration log).
AI-71-02 and AI-71-03 remain open.

Commit reconciliation (2026-09-28, recorded while working AI-71-02): every "still uncommitted" / "no
commit or PR was created" statement in the AI-71-01 narrative above describes the tree **before** the
four commits landed. The commits exist at HEAD and each maps 1:1 to the AI-71-01 deliverable: `3fad6a0`
(contract + contract test + index export), `d1281ee` (port method + adapter method + three test doubles +
adapter tests), `fcebf1f` (migration + pgTAP file), `568f5d7` (this log). Verified with
`git show --stat` on each. No history was rewritten; this note supersedes those statements. No PR was
opened (as instructed).

Rollback boundary:

- Delete `supabase/migrations/20260928235908_create_assessment_failure_handoff.sql`,
  `supabase/tests/assessment_failure_handoff.sql`, `packages/contracts/src/assessment-failure-handoff.ts` and
  `packages/contracts/src/assessment-failure-handoff.test.ts`; revert the contract export block, the port
  error code / outcome / method, the adapter method and its mapping, the three test doubles, and the block
  appended to the repository test. On the remote (authorized exception) the table, the RPC and the
  `20260928235908` history row would be dropped. No existing behavior, route, UI or unrelated persistence
  path is touched.

Not run (deliberately): `pnpm run verify` (instructed to defer) and the comprehensive deterministic matrix,
which Task #72 owns. (The "no commit or PR was created" statements above are superseded by the commit
reconciliation note.)

### AI-71-02 — application-scoped fallback routing (implemented, TDD RED→GREEN observed)

Files changed (this unit):

- `apps/api/src/application/use-cases/route-assessment-failure-to-manual-review.ts` (new) — the use case.
- `apps/api/src/application/use-cases/route-assessment-failure-to-manual-review.test.ts` (new) — 15 tests.
- `apps/api/src/infrastructure/http/routes/application-assessment.route.ts` (new) — the HTTP route.
- `apps/api/src/infrastructure/http/routes/application-assessment.route.test.ts` (new) — 14 tests.
- `apps/api/src/infrastructure/http/build-app.ts` — registers the route behind the optional
  `applicationAssessment` dependency.
- `apps/api/src/index.ts` — composition-root wiring (repository + provider + `config.llm.timeoutMs`).

Behavior:

- Endpoint `POST /application-reviews/:applicationId/assessments`: body is exactly `{ evidence }`; the
  application id comes from the path; the correlation id comes from `parseCorrelationId(request.id)`; the
  provider and the timeout always come from the dependencies and can never be chosen by a request. The
  standalone `POST /assessments` contract is unchanged.
- The use case calls the AI package's existing `runAssessment(provider, { evidence, timeoutMs })`. The AI
  package is not reimplemented or modified; `@vaqcrow/ai` is provider-independent workspace code, so
  `application/` still imports no Fastify/Supabase/Stellar/provider SDK.
- On any closed-set failure (`timeout | provider_unavailable | invalid_output |
  unknown_evidence_reference`) it persists the sanitized command through
  `recordAssessmentFailureHandoff` FIRST — `{ applicationId, correlationId, failureCode, evidence }`, no
  `providerProvenance` because a failed attempt produced none — and THEN runs
  `transition({ from: "awaiting_assessment", to: "human_review" })`. The failure path never returns an
  assessment, a recommendation or an approval.
- Labeled result: `{ outcome: "manual_review", manualReviewRequired: true, inputsPreserved: true,
  applicationState: "human_review", failureCode, correlationId, applied }`; `201` when this call routed,
  `200` when it was already applied.
- Replay/conflict: same correlation id → handoff `replayed` + transition no-op → `200` idempotent success;
  competing correlation → `409 correlation_conflict`; unknown application → `404 not_found`; application
  already `human_review` → handoff `state_conflict` confirmed with `findById` → `200` idempotent success,
  not an error; any other incompatible state → `409 state_conflict` with the actual state; repository
  unavailable → `503 unavailable`. Malformed path/body/evidence → `400 invalid_request`, before any
  repository call.
- Success path (deliberately minimal, see "Deferred"): a valid advisory assessment is returned untouched
  (`{ outcome: "assessment_available", routed: false, assessment, metadata }`, `200`) and NOTHING
  transitions.

RED evidence (before implementation, 2026-09-28):

- `pnpm --filter @vaqcrow/api exec vitest run src/application/use-cases/route-assessment-failure-to-manual-review.test.ts src/infrastructure/http/routes/application-assessment.route.test.ts` →
  - use-case suite: `Error: Cannot find module './route-assessment-failure-to-manual-review.js' imported
    from '…/route-assessment-failure-to-manual-review.test.ts'` → suite failed to collect.
  - route suite: `Test Files 2 failed (2)`, `Tests 13 failed | 1 passed (14)`. Every test observed `404`
    (`expected 404 to be 201`, `expected 404 to be 200`, `expected 404 to be 400`, `expected 404 to be
    409`, `expected 404 to be 503`) because the route was not registered; the sole pass was the
    "not registered when no application assessment is supplied" case.

GREEN evidence (after implementation, 2026-09-28):

- Same focused command → `Test Files 2 passed (2)`, `Tests 29 passed (29)` (15 use-case + 14 route).
- `pnpm --filter @vaqcrow/api test` → `Test Files 41 passed (41)`, `Tests 743 passed (743)`. (AI-71-01
  baseline recorded above was 39 files / 714 tests: +2 files / +29 tests.)
- `pnpm --filter @vaqcrow/api typecheck` (`tsc -p tsconfig.json --noEmit`) → exit 0.
- `pnpm --filter @vaqcrow/api lint` (`eslint .`) → exit 0.
- `pnpm run boundaries` → `✔ no dependency violations found (451 modules, 1348 dependencies cruised)`.
- `git diff --check` → clean (exit 0).

Commands run (exact results):

| Command | Result |
| --- | --- |
| `pnpm --filter @vaqcrow/api exec vitest run src/application/use-cases/route-assessment-failure-to-manual-review.test.ts src/infrastructure/http/routes/application-assessment.route.test.ts` (RED) | 2 files failed; use-case module not found; route 13 failed / 1 passed |
| same command (GREEN) | 2 files passed, 29 tests passed |
| `pnpm --filter @vaqcrow/api test` | 41 files passed, 743 tests passed |
| `pnpm --filter @vaqcrow/api typecheck` | exit 0 |
| `pnpm --filter @vaqcrow/api lint` | exit 0 |
| `pnpm run boundaries` | no dependency violations found (451 modules, 1348 dependencies cruised) |
| `git diff --check` | clean |

Runtime harness: `N/A` — the focused route tests drive the real Fastify app through
`app.inject()` with the AI package's deterministic simulated provider (no network, no credential), which
is the runtime boundary for this unit. No live service, remote Supabase, credential or Stellar Testnet
was used.

Deferred — the success path (deliberate, documented boundary, not an oversight): the full treatment of a
successful advisory assessment (persisting it, surfacing its provenance, the UI) belongs to a later
Feature. This unit only guarantees the invariant the Feature depends on — a valid assessment is returned
advisory and never moves the application to `human_review` — and adds no `approved` path anywhere. Human
approval remains the only route to `approved`.

Out of scope for this unit: frontend work (`AI-71-03`), Task #72's deterministic matrix, and Task #73's
evidence document.

Rollback boundary (this unit only): delete the two new use-case files and the two new route files, then
revert the `applicationAssessment` dependency + registration block in `build-app.ts` and the
`applicationAssessment` wiring in `index.ts`. No existing route, persistence path or application code was
modified, so rollback leaves AI-71-01 and every prior feature untouched.

Workload note: this work-unit commit is ~936 authored lines (925 new + 11 modified), over the 400-line
review budget. Recorded as a `size:exception`: the unit is one cohesive behavior (use case + its route +
their TDD tests), and the brief mandates a single work-unit commit with tests alongside the behavior, so
no honest split fits the budget without separating a use case from its own tests.

Commit: `8f0f196 feat(review): route failed AI assessments to truthful manual review` — 6 files, 936
insertions; the four new source/test files plus the two wiring edits. This ODD-log update is a separate
`docs(odd)` commit, matching the AI-71-01 precedent (`568f5d7`); the work unit remains exactly one
behavior commit. Not pushed; no PR opened.

### AI-71-02 correction (2026-09-28) — independent-verification defects D1–D4

Independent verification of `8f0f196` found four defects in
`apps/api/src/application/use-cases/route-assessment-failure-to-manual-review.ts` and
`apps/api/src/infrastructure/http/routes/application-assessment.route.ts`. Corrected in one bounded work
unit: `9478052 fix(review): make AI failure routing truthful and replayable` (7 files, 337 insertions /
45 deletions). No migration, RPC, seed, AI package, approval path or `POST /assessments` contract was
touched.

Defects and resolutions:

- **D1 (critical) — the payload lied about preserving inputs.** `resolveHandoffError` returned
  `inputsPreserved: true` for the `state_conflict` + `findById == human_review` case, justified by the
  false claim that this flow is the only transition into `human_review`. The atomic RPC returns
  `state_conflict` only when **no handoff row exists** (an existing row is `replayed` or
  `correlation_conflict`), so nothing was preserved for that attempt; `supabase/seed/demo-application.sql`
  inserts the demo application directly in `human_review` and no other production path creates that state.
  Fixed: that case now returns `inputsPreserved: false` and an explicit discriminator `handoff: "absent"`;
  the stale comment was rewritten.
- **D2 (warning) — idempotency was unreachable and a mid-flow crash was unrecoverable.** The route derived
  the handoff correlation from `request.id`, and `build-app.ts` sets `requestIdHeader: false` with
  `genReqId`, so every request got a fresh id: a client retry after success hit `correlation_conflict`
  (409) instead of replaying, and a crash after the handoff insert but before `transition` left a durable
  handoff with every later request 409ing forever. Fixed: the body is now exactly `{ evidence, handoffId }`;
  `handoffId` is validated through the contracts layer (`parseAssessmentHandoffId`, a new uuidv4 brand
  mirroring `human-decision-id.ts`) and stored as the handoff correlation, so a same-key retry replays and
  a different key stays `correlation_conflict`. `request.id` remains the transport correlation
  (`x-correlation-id` header and response `correlationId`) and never decides replay. A same-key retry after
  a crash replays the handoff and completes the pending transition (crash recovery restored).
- **D3 (suggestion) — replay reported a recomputed code.** On a replay the adapter returns the stored
  canonical record but the use case emitted the live `runAssessment` code. Fixed: on the replay path
  (`handoff.applied === false`) the response reports `handoff.value.record.failureCode`; the applied path
  keeps the live code (identical to the stored one the RPC echoes).
- **D4 (suggestion) — untested error branches.** Added focused tests for `resolveHandoffError` when
  `findById` returns `not_found` and when it errors otherwise, the fallback to `unavailable` for
  `already_exists | idempotency_conflict | invalid_state`, `transitionError` for `not_found` and for
  `state_conflict` without `actualState`, and the use case's own parse-failure path. The two existing tests
  that asserted `inputsPreserved: true` for the already-`human_review` case were revised to assert the
  corrected truth (`false` + `handoff: "absent"`).

Chosen truthful response shape (smallest that distinguishes the three real outcomes):

```
{
  outcome: "manual_review",
  manualReviewRequired: true,
  inputsPreserved: boolean,          // true only with a durable handoff for this attempt
  applicationState: "human_review",
  failureCode: AssessmentFailureCode, // stored canonical code on a replay
  handoff: "persisted" | "replayed" | "absent",
  correlationId: CorrelationId,       // transport trace (request.id)
  applied: boolean                    // this call performed the transition
}
```

- routed now → `handoff: "persisted"`, `inputsPreserved: true`, `applied: true`, `201`.
- same-key retry / crash recovery → `handoff: "replayed"`, `inputsPreserved: true`; `applied` follows the
  transition (`200` replay, `201` when this call completed the pending transition).
- already `human_review` with no handoff → `handoff: "absent"`, `inputsPreserved: false`, `applied: false`,
  `200`. The response still says manual review is required, but no longer claims the inputs were preserved.

RED evidence (2026-09-28, before implementation; TDD active):

- RED #1 — tests written, no implementation:
  - `pnpm --filter @vaqcrow/contracts exec vitest run src/assessment-handoff-id.test.ts` →
    `TypeError: (0 , parseAssessmentHandoffId) is not a function`; `Test Files 1 failed (1)`,
    `Tests 2 failed | 4 passed (6)`.
  - `pnpm --filter @vaqcrow/api exec vitest run src/application/use-cases/route-assessment-failure-to-manual-review.test.ts src/infrastructure/http/routes/application-assessment.route.test.ts`
    → use-case suite failed to collect (`TypeError: (0 , parseAssessmentHandoffId) is not a function`,
    `Tests no tests`); route suite `Test Files 2 failed (2)`, `Tests 10 failed | 7 passed (17)` (every
    expected status observed as `400` because the body key set still admitted only `evidence`).
- RED #2 — contract added and `@vaqcrow/contracts` rebuilt, behavior not yet implemented:
  - contracts focused runner → `Test Files 1 passed (1)`, `Tests 6 passed (6)`.
  - API focused runner → `Test Files 2 failed (2)`, `Tests 15 failed | 27 passed (42)`: the result object
    had 7 keys instead of 8 (missing `handoff`), the handoff correlation was `request.id`'s correlation
    instead of `handoffId`, the replay still reported the live failure code, and the route rejected the
    `handoffId` body with `400`.

GREEN evidence (2026-09-28, after implementation):

- `pnpm --filter @vaqcrow/contracts exec vitest run src/assessment-handoff-id.test.ts` → 1 file, 6 tests
  passed.
- API focused runner → `Test Files 2 passed (2)`, `Tests 42 passed (42)` (25 use-case + 17 route; baseline
  was 29, +13).
- `pnpm --filter @vaqcrow/api test` → `Test Files 41 passed (41)`, `Tests 756 passed (756)` (baseline 743,
  +13).
- `pnpm --filter @vaqcrow/api typecheck` → exit 0; `pnpm --filter @vaqcrow/api lint` → exit 0.
- `pnpm --filter @vaqcrow/contracts typecheck` → exit 0; `pnpm --filter @vaqcrow/contracts lint` → exit 0.
- `pnpm run boundaries` → exit 0, `no dependency violations found (453 modules, 1354 dependencies cruised)`.
- `git diff --check` → exit 0 (clean).

Commands run (exact results):

| Command | Result |
| --- | --- |
| contracts focused runner (RED #1) | 1 file failed; `parseAssessmentHandoffId is not a function`; 2 failed / 4 passed (6) |
| API focused runner (RED #1) | 2 files failed; use-case suite failed to collect; route 10 failed / 7 passed (17) |
| contracts focused runner (RED #2) | 1 file passed, 6 tests passed |
| API focused runner (RED #2) | 2 files failed, 15 failed / 27 passed (42) |
| contracts focused runner (GREEN) | 1 file passed, 6 tests passed |
| API focused runner (GREEN) | 2 files passed, 42 tests passed |
| `pnpm --filter @vaqcrow/api test` | 41 files passed, 756 tests passed |
| `pnpm --filter @vaqcrow/api typecheck` | exit 0 |
| `pnpm --filter @vaqcrow/api lint` | exit 0 |
| `pnpm --filter @vaqcrow/contracts typecheck` | exit 0 |
| `pnpm --filter @vaqcrow/contracts lint` | exit 0 |
| `pnpm run boundaries` | exit 0; no dependency violations (453 modules, 1354 dependencies cruised) |
| `git diff --check` | exit 0, clean |

Boundaries preserved: `apps/api/src/application` stays Fastify/Supabase/LLM-SDK-free (it imports only
`@vaqcrow/ai` and `@vaqcrow/contracts` types plus the contracts parser), the route stays in
`infrastructure/http/`, `packages/contracts` imports no `apps/*`, and the standalone `POST /assessments`
contract is unchanged. No approval path was added; `human_review → approved` remains solely the
human-decision flow.

Runtime harness: `N/A` — the focused route tests drive the real Fastify app through `app.inject()` with the
AI package's deterministic simulated provider (no network, no credential), which is the runtime boundary
for this unit.

Rollback boundary (this correction only): revert `9478052` — delete
`packages/contracts/src/assessment-handoff-id.ts` and its test, revert the `index.ts` export block, and
revert the two use-case files and two route files. This removes only the correction; the original AI-71-02
commit `8f0f196` and every prior feature remain untouched, and no migration, RPC, seed or approval path is
involved.

Engram mirror: **not written — Engram unavailable.** `mem_current_project` resolved the project as
`vaqcrow` (`project_source: git_remote`), but two `mem_save` attempts for topic
`odd/implement-ai-failure-routing-to-manual-review/tasks` (type `architecture`, scope `project`,
`capture_prompt: false`) both failed with
`gentle-engram could not confirm Engram session registration for engram_mem_save; verify that the Engram
server is available and retry`. This matches the reported `ambiguous_active_runtime_sessions` condition;
no session id was invented and no write succeeded. **This ODD file is authoritative** for the correction
record until a later session can mirror it.

### AI-71-03 — truthful human-review context (implemented, TDD RED→GREEN observed, committed)

Files changed (this unit — 22 files, 1047 insertions / 18 deletions):

- `packages/contracts/src/application-manual-review.ts` (new) + `.test.ts` (new) + `index.ts` export —
  the portable read view-model.
- `apps/api/src/application/ports/application-review-repository-port.ts` — read path.
- `apps/api/src/infrastructure/adapters/supabase-application-review-repository.ts` — adapter read.
- `apps/api/src/infrastructure/adapters/supabase-application-review-repository.test.ts` — 6 new tests
  (the fake client now records `from(table)` for the read's table assertion).
- `apps/api/src/infrastructure/http/routes/application-manual-review.route.ts` (new) + `.test.ts` (new).
- `apps/api/src/infrastructure/http/build-app.ts` — registers the read route under the existing
  `applicationReviewRepository` dependency.
- Full-port test doubles updated for the widened port: `open-campaign.test.ts`,
  `record-human-decision.test.ts`, `human-decision.route.test.ts`, `application-assessment.route.test.ts`.
- `apps/web/src/application/ports/manual-review-gateway.ts` (new).
- `apps/web/src/infrastructure/manual-review/http-manual-review-gateway.ts` (new) + `.test.ts` (new) +
  `default-gateway.ts` (new).
- `apps/web/src/state/use-manual-review-context.ts` (new).
- `apps/web/src/presentation/components/manual-review-context-panel.tsx` (new) + `.test.tsx` (new).
- `apps/web/src/presentation/components/human-decision-workspace.tsx` (+ `.test.tsx`) — integration.

Behavior:

- **Portable contract.** `applicationManualReviewContextSchema` is a strict object with
  `{ applicationId, applicationState, failureCode, evidence, providerProvenance?, recordedAt }`:
  the sanitized closed-set failure code, the validated synthetic evidence bundle, the optional
  strictly-shaped provenance (so a `simulated` source stays labelled), the application state and the
  stored timestamp. No Node core / Fastify imports; raw provider diagnostics have no field and are
  rejected as unknown keys.
- **Read endpoint.** `GET /application-reviews/:applicationId/manual-review`: malformed path →
  `400 { code: "invalid_request" }` before any repository call; the persisted context (200) otherwise;
  `404 { code: "not_found" }` when no handoff exists — reported truthfully, never empty-but-successful;
  `503 { code: "unavailable" }` for any other repository failure. The adapter reads the
  `assessment_failure_handoff` row (existing `service_role` SELECT grant; **no migration change**), then
  the application state via `findById`, and re-validates through the shared parser.
- **Exact read shape** (200 body, keys exactly these; `providerProvenance` omitted when the stored row
  declares none):

  ```
  {
    applicationId: string,
    applicationState: "draft" | "awaiting_assessment" | "human_review" | "approved"
                      | "changes_requested" | "rejected",
    failureCode: "timeout" | "provider_unavailable" | "invalid_output" | "unknown_evidence_reference",
    evidence: { periods: SalesPeriodContract[], findings: ReviewFinding[] },
    providerProvenance?: { model, promptVersion, generatedAt, source: "provider" | "simulated" },
    recordedAt: string   // ISO 8601 with offset
  }
  ```

- **Web.** `HumanDecisionWorkspace` loads the context through an injectable `ManualReviewGateway`
  (mirroring the existing `HumanDecisionGateway`). When the context is `present`, `ManualReviewContextPanel`
  renders it and the disconnected `simulatedAssessment` recommendation is **not** rendered. When the
  context is absent (no handoff, no gateway, or a failed request), the existing simulated recommendation
  remains — the unrelated flow, unchanged. The panel shows `SIMULADO` only when
  `providerProvenance.source === "simulated"`; a `provider` source names its model; an absent provenance
  says "Sin procedencia declarada". No approval control exists anywhere in the panel (tested).

RED evidence (before implementation, 2026-09-28; TDD active):

- `pnpm --filter @vaqcrow/contracts exec vitest run src/application-manual-review.test.ts` →
  `Error: Cannot find module './application-manual-review.js'`; `Test Files 1 failed (1)`, `Tests no tests`.
- `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/adapters/supabase-application-review-repository.test.ts`
  → `TypeError: (intermediate value).readManualReviewContext is not a function`; `Test Files 1 failed (1)`,
  `Tests 6 failed | 32 passed (38)`.
- `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/http/routes/application-manual-review.route.test.ts`
  → `Test Files 1 failed (1)`, `Tests 4 failed | 1 passed (5)`; observed `expected 404 to be 200`,
  `expected 404 to be 503`, `expected 404 to be 400`, and the 404 body mismatch (the route did not exist;
  the one pass was the "not registered" case).
- `pnpm --filter @vaqcrow/web exec vitest run src/infrastructure/manual-review/http-manual-review-gateway.test.ts src/presentation/components/manual-review-context-panel.test.tsx src/presentation/components/human-decision-workspace.test.tsx`
  → gateway and panel suites failed to collect (`Cannot find module './http-manual-review-gateway'` /
  `'./manual-review-context-panel'`); workspace suite `Tests 1 failed | 6 passed (7)` (the persisted-context
  test waited in vain for context that the component did not yet accept).

GREEN evidence (after implementation, 2026-09-28):

- Contracts focused runner → `Test Files 1 passed (1)`, `Tests 5 passed (5)`.
- API focused runners → adapter `38 passed (38)`; route `5 passed (5)`.
- Web focused runners → `Test Files 4 passed (4)`, `Tests 23 passed (23)` (gateway 7 + panel 6 + workspace 7
  + approval page 3).
- `pnpm --filter @vaqcrow/contracts test` → `Test Files 12 passed (12)`, `Tests 344 passed (344)`.
- `pnpm --filter @vaqcrow/api test` → `Test Files 42 passed (42)`, `Tests 767 passed (767)`.
- `pnpm --filter @vaqcrow/web test` → `Test Files 100 passed (100)`, `Tests 701 passed (701)` (first run on
  this tree; see the flake note below).
- typecheck and lint exit 0 for `@vaqcrow/contracts`, `@vaqcrow/api` and `@vaqcrow/web` (the one web lint
  warning, `fetch-http-client.ts: _request`, pre-exists and is untouched).

Commands run (exact results):

| Command | Result |
| --- | --- |
| contracts focused runner (RED) | 1 file failed; module not found; no tests |
| API adapter focused runner (RED) | 1 file failed; `readManualReviewContext is not a function`; 6 failed / 32 passed |
| API route focused runner (RED) | 1 file failed; 4 failed / 1 passed (all 404s) |
| web focused runner (RED) | 3 files failed; 2 suites uncollectable; workspace 1 failed / 6 passed |
| contracts focused runner (GREEN) | 1 file passed, 5 tests passed |
| API adapter focused runner (GREEN) | 1 file passed, 38 tests passed |
| API route focused runner (GREEN) | 1 file passed, 5 tests passed |
| web focused runner (GREEN) | 4 files passed, 23 tests passed |
| `pnpm --filter @vaqcrow/contracts test` | 12 files passed, 344 tests passed |
| `pnpm --filter @vaqcrow/api test` | 42 files passed, 767 tests passed |
| `pnpm --filter @vaqcrow/web test` | 100 files passed, 701 tests passed |
| `pnpm --filter @vaqcrow/contracts typecheck` / `lint` | exit 0 / exit 0 |
| `pnpm --filter @vaqcrow/api typecheck` / `lint` | exit 0 / exit 0 |
| `pnpm --filter @vaqcrow/web typecheck` / `lint` | exit 0 / exit 0 (one pre-existing warning) |
| `pnpm run boundaries` | exit 0; `no dependency violations found (467 modules, 1400 dependencies cruised)` |
| `git diff --check` | clean (exit 0) |

`pnpm run verify`:

- First attempt (2026-09-28, 22:14) → **failed only on `@vaqcrow/web#test`**: 2 tests timed out at the
  5000 ms default in files untouched by this unit (`layout.traversal.test.tsx`,
  `theme-switcher.test.tsx`). The other 7 tasks passed.
- A second, otherwise-idle attempt showed the same class of flake rotating through different untouched
  files (and once this unit's own pre-existing "records a decision" workspace test); every such file passed
  when re-run in isolation (`5 files passed, 32 tests passed` for one isolated batch; `2 files passed,
  8 tests passed` for another).
- A later standard run **exited 0**: all 8 tasks successful, `@vaqcrow/web:test 100 passed`,
  `@vaqcrow/contracts:test 12 passed`, `@vaqcrow/api:test 42 passed`, `test:boundaries 9 files / 93 tests
  passed`, `boundaries no dependency violations found`.

Flake assessment: the 5000 ms `vitest` default is tight for the jsdom-heavy web suite under the CPU load of
a full `turbo` run; the failures are timeouts (never assertion failures), rotate across unrelated files,
and disappear in isolation. **Not caused by this unit** (the first full web run on this exact tree passed
100 files / 701 tests), and not a `main` regression this unit introduced. No config change was made to
mask it.

Runtime harness: `N/A` — the focused tests drive the real Fastify app through `app.inject()` and the React
components through `@testing-library/react` with injectable gateways; no live network, remote Supabase,
credential, Stellar Testnet or LLM provider was used.

Boundaries preserved: `packages/contracts/src` imports only `zod` and its own modules (no Node core /
Fastify); `apps/api/src/application` imports only contract types/parsers plus the AI package (no
Fastify/Supabase/LLM SDK); the route stays in `infrastructure/http/`; `apps/web` imports no
`packages/domain`, and `presentation/` touches `@vaqcrow/contracts` type-only (`infrastructure/` uses the
contract parser, matching `http-human-decision-gateway.ts`). `pnpm run boundaries` and `pnpm run
test:boundaries` pass. No approval path was added or implied; `human_review → approved` remains solely the
human-decision flow.

Size note: this work-unit commit is 1065 authored lines (1047 insertions + 18 deletions), over the
400-line review budget. Recorded as a `size:exception`, matching the AI-71-02 precedent: the unit is one
cohesive behavior (a contract + its read endpoint + the UI that consumes it, with tests alongside each),
and the brief mandates a single work-unit commit that closes the implementation task; no honest slice fits
the budget without separating a route from its port/contract or a component from its hook.

Rollback boundary (this unit only): delete
`packages/contracts/src/application-manual-review.ts` and its test, revert the `index.ts` export block;
revert the `readManualReviewContext` port method, the adapter method/interface/table constant, the 6 adapter
tests, the `from` recording in the adapter fake, the manual-review route files and the `build-app.ts`
registration, and the four test-double additions; delete the web `manual-review-gateway` port, the
`infrastructure/manual-review/` directory, the `use-manual-review-context.ts` hook, the
`manual-review-context-panel.tsx` + test, and revert the `human-decision-workspace.tsx` (+ test) changes.
This removes only AI-71-03; AI-71-01/02 and every prior feature remain untouched, and no migration, RPC,
seed or approval path is involved.

Engram mirror: **not written — Engram unavailable.** The `mem_save` call for topic
`odd/implement-ai-failure-routing-to-manual-review/tasks` (project `vaqcrow`, type `architecture`, scope
`project`, `capture_prompt: false`) failed with `gentle-engram could not confirm Engram session
registration for engram_mem_save; verify that the Engram server is available and retry`, matching the
reported `ambiguous_active_runtime_sessions` condition. No session id was invented and no write succeeded.
**This ODD file is authoritative** for the AI-71-03 record.

## Next step

- AI-71-03 is delivered (`c4db07d`): the human-review experience reads and renders the persisted
  manual-review context for this flow, and the disconnected simulated recommendation is removed for it
  only. Not yet wired end to end in the demo browser: `AssessmentWorkspace` still posts to the standalone
  `POST /assessments`, not the application-scoped `POST /application-reviews/:applicationId/assessments`,
  so a web-triggered failure does not yet create the handoff the approval page then reads. That wiring is
  outside AI-71-03's stated scope (the read path + UI), and is the most likely candidate for the next
  slice if the Feature wants a click-through demo.
- Task #72 owns the comprehensive deterministic matrix; Task #73 owns the Feature evidence document.
- The remote blocker is cleared — both migrations are on the configured remote and verified (handoff
  recorded as `20260928235908`). Still to reconcile if the local docker stack is reused for
  `migration up --local`: the local migration history still records the handoff at `20260928120000`.
