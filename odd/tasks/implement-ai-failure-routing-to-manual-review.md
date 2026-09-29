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
- [ ] **AI-71-03 — Truthful human-review context.** Connect the human-review UI to persisted manual-review
      context for this flow. Remove the disconnected simulated recommendation only for this failure flow.
      Load a HeroUI or frontend-design skill only if the implementation changes HeroUI UI.

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

## Next step

- AI-71-03: connect the human-review UI to the persisted manual-review context for this flow and remove
  the disconnected simulated recommendation for the failure flow. Load a HeroUI/frontend-design skill
  only if the implementation changes HeroUI UI.
- Task #72 owns the comprehensive deterministic matrix; Task #73 owns the Feature evidence document.
- The remote blocker is cleared — both migrations are on the configured remote and verified (handoff
  recorded as `20260928235908`). Still to reconcile if the local docker stack is reused for
  `migration up --local`: the local migration history still records the handoff at `20260928120000`.
