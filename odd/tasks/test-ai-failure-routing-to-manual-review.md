# Test AI failure routing to manual review

Iteration log for GitHub Task #72 under Feature #22. Branch:
`Vaqcrow#72_Task_Test_AI_failure_routing_to_manual_review`, base `main` `927e923`.

## Objective

Prove Feature #22's failure flow end to end with deterministic tests: a failed AI assessment routes to
truthful, persisted manual review; a valid assessment never transitions; every validation, rejection and
fallback branch is covered; and nothing in the suite reaches Testnet, Horizon, a live LLM provider or a
real clock. Also close the two gaps declared by Task #71 honestly and minimally.

## Problem / why

Task #71 implemented the whole Feature — the closed-set failure classifier, the durable sanitized
handoff, the persist-before-transition routing use case, the two HTTP routes, and the manual-review read
path plus its web panel — but left the comprehensive deterministic matrix to Task #72. Two gaps were
declared in the Task #71 log:

1. `apps/web/src/state/use-manual-review-context.ts` funnelled **every** rejection of `gateway.load` into
   `{ status: "absent" }` — the same value as a truthful `404`. That discarded the distinction the
   `ManualReviewGateway` port exists to preserve (`null` = no handoff, throw = could not request), so
   during a backend outage the workspace re-rendered the disconnected simulated recommendation for an
   application whose handoff was actually durable.
2. The migration validates the evidence bundle only at the top level
   (`jsonb_typeof(...) = 'object'` / `'array'`, `jsonb_array_length(periods) >= 1`, provenance an object)
   while the read adapter re-validates the stored row through the strict contract parser. A stored row
   can therefore pass the DB CHECK but fail the parser; the read then fails closed to `unavailable`
   (503).

The planning source is [[docs/planning/demo-tasks-list#^issue-22|Feature #22]] and
[[docs/planning/demo-tasks-list#^issue-72|Task #72]]; the implementation it tests is recorded in
[[odd/tasks/implement-ai-failure-routing-to-manual-review|implement-ai-failure-routing-to-manual-review]].

## Authorized scope

In scope:

- Deterministic coverage that formalizes Feature #22's matrix at the narrowest effective level:
  successful behaviour, validation/rejection boundaries, and every fallback branch.
- A determinism guard where it adds real value.
- The minimal web-hook fix (RED first) for the outage-vs-absent gap, and the workspace render that stops
  presenting the simulated recommendation during an outage.
- An honest test recording the migration/adapter constraint asymmetry if it can be added without
  asserting wrong behaviour; otherwise a follow-up recommendation in this log.

Out of scope:

- Any approval path. `human_review -> approved` remains solely the human-decision flow.
- The AI package, the migration, and the RPC (`record_assessment_failure_handoff`).
- Any live external service, credential, remote Supabase project, Stellar Testnet, Horizon, real LLM,
  secret, PII or seed.
- Production behaviour beyond the single bounded web-hook fix the issue's gap list authorizes.

## Constraints

- TDD is active. Runners:
  `pnpm --filter @vaqcrow/contracts exec vitest run`,
  `pnpm --filter @vaqcrow/api exec vitest run`,
  `pnpm --filter @vaqcrow/web exec vitest run`.
  Record observed RED before each implementation change; never invent evidence. Pure test additions that
  characterize already-correct behaviour are reported as passing on first run (no RED claimed).
- Fixtures and doubles only: the AI package's deterministic simulated provider, hand-written repository
  doubles, and React Testing Library with injectable gateways.
- Preserve boundaries: `apps/api/src/application` stays Fastify/Supabase/LLM-SDK-free (type-only imports
  only); routes stay in `infrastructure/http/`; `apps/web` never imports `packages/domain` and imports
  `packages/contracts` type-only from `presentation/` (infrastructure may use the contract parser).
- No migration or RPC change.
- Artifacts are English; UI copy follows the existing Spanish of the approval surface.

## Delivery strategy

`ask-on-risk`. The matrix is one cohesive test unit per slice (contracts already covered, API use case +
route, adapter boundary, web hook + workspace); no size or coupling risk required a chained slice.

## Actionable checklist

- [x] **AI-72-01 — Confirm the architecture, harnesses, existing focused coverage and the two declared
      gaps.** Read the Task #71 log and every source/test file it names; confirmed the four runners, the
      jsdom web harness (`renderHook`, `@testing-library/react`), and that the gap list matches the code
      (`use-manual-review-context.ts` `.catch -> absent`; top-level-only DB CHECK vs strict parser).
- [x] **AI-72-02 — Formalize the deterministic matrix for the failure flow.** Added the missing cases at
      the narrowest effective level: the four closed-set codes at the HTTP boundary, the crash-recovery
      (`replayed` + applied) branch, the exact sanitized routing key set, the adapter's derived state
      after a crash, and the constraint-asymmetry record. Success/no-transition, validation/rejection
      boundaries, replay/conflict/not-found/state-conflict and the truthful read `not_found` were already
      covered and were audited rather than duplicated — see the matrix below.
- [x] **AI-72-03 — Determinism guard.** Added a focused test that runs the same input twice and asserts
      deep-equal results and identical repository commands, asserts the advisory metadata timestamp is the
      injected fixed clock (not wall time), and asserts `fetch` was never called. A route-level guard
      asserts the sanitized body is stable across runs (the per-request transport id is excluded by
      design).
- [x] **AI-72-04 — RED then GREEN: the web hook outage gap.** Observed RED (4 failing tests), then fixed
      the hook so "the context could not be requested" is its own `unavailable` state distinct from a
      truthful `absent`, and the workspace never presents the simulated recommendation as the persisted
      context during an outage.
- [x] **AI-72-05 — Document the constraint asymmetry honestly.** Added an adapter test recording the
      current boundary (a row the DB CHECK admits but the strict parser rejects -> `unavailable`) without
      asserting wrong behaviour; the fix/recommendation is recorded under "Follow-up" below.
- [x] **AI-72-06 — Ran the focused suites, per-workspace typecheck/lint, `pnpm run boundaries`,
      `git diff --check`, and the full `pnpm run verify` (all green; exact results below).**
- [x] **AI-72-07 — Work-unit commits, this ODD update, and the Engram mirror attempt (failed; recorded).**

## Acceptance criteria (verbatim from issue #72)

- deterministic tests demonstrate the core behavior;
- validation, rejection and fallback behavior is covered;
- the focused suite passes without live external services or sensitive data.

## Deterministic matrix (audited + added)

| Matrix row | Level | Status |
| --- | --- | --- |
| Valid advisory assessment returned, nothing transitions | use case + route | audited (pre-existing) |
| Malformed path / body / evidence rejected before any repository call | route | audited (pre-existing) |
| Body whose key set drifted rejected | route | audited (pre-existing) |
| Non-uuid / missing / non-string handoff id rejected | contract + route | audited (pre-existing) |
| All four closed-set failure codes -> manual review, sanitized code | use case (all four) | audited (pre-existing) |
| All four closed-set failure codes at the HTTP boundary (201, exact key set) | route | **added** |
| Failure path never carries assessment / recommendation / approval (exact key set) | use case + route | **added** (strengthened from a partial check) |
| `handoff: "persisted"` + `inputsPreserved: true` + `applied: true` | use case + route | audited (pre-existing) |
| `handoff: "replayed"` + `inputsPreserved: true`, `applied` follows the transition | use case + route | audited (pre-existing, replay=no-op) |
| Crash recovery: replayed handoff completes the pending transition (`applied: true`, 201) | use case + route | **added** |
| `handoff: "absent"` + `inputsPreserved: false` (already in review, no handoff) | use case + route | audited (pre-existing) |
| Competing correlation -> `409 correlation_conflict` | use case + route | audited (pre-existing) |
| Unknown application -> `404 not_found` | use case + route | audited (pre-existing) |
| Incompatible state -> `409 state_conflict` with the actual state | use case + route | audited (pre-existing) |
| Same input -> same result across runs; injected fixed clock; no network | use case + route | **added** |
| Manual-review read: persisted context, truthful `404 not_found`, sanitized `503` | adapter + route | audited (pre-existing) |
| Manual-review read after a crash: handoff durable, current state reported | adapter | **added** |
| DB CHECK admits a row the strict parser rejects -> read fails closed to `unavailable` | adapter | **added** (documents the asymmetry) |
| Web: persisted context replaces the simulated recommendation | hook + workspace + panel | audited (pre-existing) |
| Web: truthful `absent` keeps the unrelated-flow simulated recommendation | hook + workspace | audited (pre-existing) |
| Web: request failed -> distinct state, outage notice, no simulated recommendation | hook + workspace | **added** (behavior fix) |

## Observed TDD evidence

### RED — web hook/workspace (before the implementation change, 2026-09-29)

`pnpm --filter @vaqcrow/web exec vitest run src/state/use-manual-review-context.test.tsx src/presentation/components/human-decision-workspace.test.tsx`
→ `Test Files 2 failed (2)`, `Tests 4 failed | 10 passed (14)`:

- `use-manual-review-context.test.tsx`: `reports unavailable, never absent, when the context could not be
  requested (a 503 unavailable)`, `... (a network failure)`, and `reports unavailable when the response
  drifted out of contract rather than absent` — the hook set `absent` (the `waitFor` for `unavailable`
  timed out).
- `human-decision-workspace.test.tsx`: `shows a truthful outage notice instead of the simulated
  recommendation when the context could not be loaded` — no alert existed and the simulated
  `Recomendación de IA` region was still rendered.

### RED — API matrix (2026-09-29, my own assertion bug; recorded for honesty)

`pnpm --filter @vaqcrow/api exec vitest run src/application/use-cases/route-assessment-failure-to-manual-review.test.ts src/infrastructure/http/routes/application-assessment.route.test.ts src/infrastructure/adapters/supabase-application-review-repository.test.ts`
→ `Test Files 2 failed | 1 passed (3)`, `Tests 5 failed | 87 passed (92)`, failing with
`AssertionError: expected [ 'applicationState', 'applied', …(6) ] to deeply equal [ 'applied',
'applicationState', …(6) ]`. The expected key array was written unsorted while `Object.keys().sort()`
sorts it; `'applicationState' < 'applied'`. This was a test-authoring defect, not a production defect:
the added cases characterize already-correct behaviour. Both expected arrays were corrected to the sorted
order.

### GREEN

- API focused runner (3 files) → `Test Files 3 passed (3)`, `Tests 92 passed (92)`
  (use case 28, route 23, adapter 41; baseline for these files was 25 + 17 + 38 = 80, +12).
- Web focused runner (hook + workspace + gateway + panel) → `Test Files 4 passed (4)`, `Tests 27 passed
  (27)` (the RED files plus the two pre-existing read-path suites re-run as regression).

## Commands run (exact results)

| Command | Result |
| --- | --- |
| API focused runner (RED, my assertion bug) | 2 files failed; 5 failed / 87 passed (92); unsorted expected key array |
| Web focused runner (RED) | 2 files failed; 4 failed / 10 passed (14) |
| API focused runner (GREEN) | 3 files passed, 92 tests passed |
| Web focused runner (GREEN) | 4 files passed, 27 tests passed |
| `pnpm --filter @vaqcrow/contracts test` | 12 files passed, 344 tests passed |
| `pnpm --filter @vaqcrow/api test` | 42 files passed, 779 tests passed (baseline 767, +12) |
| `pnpm --filter @vaqcrow/web test` | 101 files passed, 708 tests passed (baseline 100/701, +1 file / +7 tests) |
| `pnpm --filter @vaqcrow/api typecheck` | exit 0 |
| `pnpm --filter @vaqcrow/web typecheck` | exit 0 |
| `pnpm --filter @vaqcrow/api lint` | exit 0 (fixed one `no-unused-vars` I introduced) |
| `pnpm --filter @vaqcrow/web lint` | exit 0 (one pre-existing warning: `fetch-http-client.ts:8 _request`) |
| `pnpm run boundaries` | exit 0; no dependency violations (468 modules, 1406 dependencies cruised) |
| `git diff --check` | exit 0, clean |
| `pnpm run verify` | **exit 0** on the first run — 5/5 turbo tasks + the root gate; no flake |

`pnpm run verify` detail (from the same run): `contracts:test 344 passed`, `domain:test 60 passed`,
`ai:test 107 passed`, `api:test 42 files / 779 passed`, `web:test 101 files / 708 passed`,
`test:boundaries 9 files / 93 passed`, `boundaries no dependency violations found (468 modules, 1406
dependencies cruised)`, `@vaqcrow/web:build` completed. The known jsdom 5 s timeout flake did not occur
on this run; nothing was changed to mask it.

## Constraints preserved

- No approval path was added: the failure flow labels manual review only, and the human-decision route
  remains the sole writer of `approved`.
- No migration or RPC change; no AI package change; no contract change.
- `apps/api/src/application` stays Fastify/Supabase/LLM-SDK-free; routes stay in `infrastructure/http/`;
  `apps/web` imports no `packages/domain` and touches `@vaqcrow/contracts` type-only from
  `presentation/`. `pnpm run boundaries` and `pnpm run test:boundaries` pass.
- No live external service, credential, remote Supabase, Testnet, Horizon, LLM provider, secret, PII or
  seed was used in any test; every double is local and every fixture is synthetic.

## Follow-up — the migration/adapter constraint asymmetry

Decision: **documented, not fixed.** The migration and the RPC are explicitly out of scope for this task,
and the read already fails closed to a sanitized `unavailable` (503) for any stored row the strict parser
rejects, so the asymmetry cannot produce a widened or fabricated record. A test now records that boundary
honestly (`fails closed to unavailable for a stored row the DB CHECK admits but the strict parser
rejects`).

Recommendation for a later, migration-scoped task: either accept the top-level-only CHECK as intentional
defense-in-depth (the strict read parser is the authoritative validator, and duplicating the full contract
in SQL invites drift), or — if the project wants database-level parity — tighten the CHECK to validate the
period/finding/provenance key sets, ideally generated from the contract to avoid divergence. Prefer the
first unless a concrete non-application writer of that table appears.

## Rollback boundary

- Revert the matrix commit (`db80aa9`): it is test-only — three API test files return to `main`.
- Revert the fix commit (`32ced80`): delete `apps/web/src/state/use-manual-review-context.test.tsx` and the
  workspace outage test, revert `use-manual-review-context.ts` (drop the `unavailable` state and restore
  the `.catch -> absent`) and `human-decision-workspace.tsx` (drop the outage branch).
- No production API, contract, migration, RPC, AI-package or fixture file is touched; rollback removes
  only this task.

## Delivery evidence

- Work-unit commits on the branch: `db80aa9 test(review): formalize deterministic AI failure routing
  matrix` (3 files, 234 insertions, test-only) and `32ced80 fix(review): distinguish manual-review outage
  from no handoff` (4 files: 2 source + 2 tests). This ODD log is the final `docs(odd)` commit. Not
  pushed; no PR opened.
- Authored line count is well below the 400-line `ask-on-risk` threshold across both commits.

## Engram mirror

**Not written — Engram unavailable.** The `mem_save` call for topic
`odd/test-ai-failure-routing-to-manual-review/tasks` (project `vaqcrow`, type `architecture`, scope
`project`, `capture_prompt: false`) failed with `gentle-engram could not confirm Engram session
registration for engram_mem_save; verify that the Engram server is available and retry`, matching the
`ambiguous_active_runtime_sessions` condition reported by the previous writer. No session id was invented
and no write succeeded. **This ODD file is authoritative** for the Task #72 record.

## Next step

- Task #73 owns the Feature evidence document. The matrix and command evidence above, plus the
  determinism guard and the recorded constraint asymmetry, are what it should consume.
