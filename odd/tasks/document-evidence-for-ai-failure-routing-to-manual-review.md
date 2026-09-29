# Document evidence for AI failure routing to manual review

Iteration log for GitHub Task #73 under Feature #22. Branch:
`Vaqcrow#73_Task_Document_evidence_for_AI_failure_routing_to_manual_review`, base `main` `e185fd6`.

## Objective

Produce a reproducible, non-sensitive closure evidence document for Feature #22 (AI failure routing to
manual review), traceable to the merged implementation (Task #71) and its deterministic tests (Task #72),
and record the focused checks that are actually re-run on this branch.

## Problem / why

The implementation and its deterministic matrix already exist on `main`, but their results are spread
across two iteration logs, several commits and two merged PRs. Task #73 requires one document that lets a
reviewer verify the delivered behaviour, the simulation limits and the current reproduction without
inventing a production integration. It is the document-evidence Task that closes the Feature sequence.

## Authorized scope

In scope:

- Create `docs/planning/ai-failure-routing-evidence.md` in Spanish (the evidence corpus convention),
  quoting every acceptance criterion of #22/#71/#72 verbatim from its own issue.
- Map each criterion to the concrete file, commit and observed result that satisfies it.
- Re-run the focused failure-flow suites and `pnpm run verify` on this branch and record the exact output.
- Update `docs/planning/demo-tasks-list.md` so #71 and #72 are marked delivered/merged (matching the
  monthly-sales-feed precedent), leaving #73 unmarked until it merges.
- Record the honest limits: the declared Task #71 and Task #72 review advisories, the deferred success
  path, the end-to-end browser wiring gap, and the absence of any approval path.

Out of scope:

- Any change to production code, tests, migrations, RPCs or contracts.
- Modifying the historical `odd/tasks/implement-*` and `odd/tasks/test-*` logs.
- GitHub mutations (push, PR, issue/label edits), remote Supabase, live services or credentials.
- Any approval path. `human_review -> approved` remains solely the human-decision flow.

## Constraints

- Documentation only. If a check reveals a discrepancy between the logs and reality, record it; do not fix
  code and do not alter the historical logs.
- Every verification result names its source: a command re-run in this working tree (with exact output) or
  a specific recorded PR/CI run. Never report a merged state that does not exist.
- Exclude secrets, PII, seeds, unnecessary XDR and any unsupported production claim. The demo is
  explicitly non-production.
- Obsidian-compatible Markdown: callouts and wikilinks with display text, matching the repository.

## Delivery strategy

`ask-on-risk`. One documentation unit under the 400-line review budget: the evidence document, the roadmap
state update and this ODD record. No runtime boundary exists; rollback is document-only. Ask before any
scope expansion beyond documentation.

## Actionable checklist

- [x] **T73-01 — Read the sources.** Two sibling evidence documents, the #71/#72 iteration logs, and issues
      #22/#71/#72/#73 read-only; confirm the merge chain on `main`.
- [x] **T73-02 — Re-run the focused failure-flow suites.** Contracts handoff/id, API use case + assessment
      route + adapter + manual-review route, web hook + workspace + gateway + panel; record exact output.
- [x] **T73-03 — Run `pnpm run verify` and `git diff --check`.** Record the real result.
- [x] **T73-04 — Write `docs/planning/ai-failure-routing-evidence.md`.** Spanish, neutral register,
      acceptance criteria verbatim in English, criteria-to-evidence mapping, honest limits.
- [x] **T73-05 — Update `docs/planning/demo-tasks-list.md`.** Mark #71 and #72 delivered/merged; leave #73
      unmarked until it merges.
- [x] **T73-06 — Work-unit commits and ODD closure.** The documentation unit landed as `f7626f8
      docs(planning): record AI failure routing evidence` (2 files, 187 insertions / 4 deletions: the
      evidence document and the roadmap state update); this ODD record is the follow-up `docs(odd)` commit.
      Conventional messages, no AI attribution, no push/PR.
- [x] **T73-07 — Engram mirror attempt** (project `vaqcrow`, type `architecture`, scope `project`,
      `capture_prompt:false`); recorded plainly as failed below.

## Acceptance criteria (verbatim, issue #73)

- Evidence identifies Feature #22, verification commands, and observed results.
- Evidence is traceable to implementation and focused tests.
- Sensitive data and unsupported production claims are excluded.

## Verification plan

1. Confirm the merge chain from the local `main` graph (`927e923` for #71 via PR #338, `e185fd6` for #72 via
   PR #339) and the earlier `c1a59ff` (#71 part 1 via PR #335).
2. Run the focused suites named in the #71/#72 logs against the current tree.
3. Run `pnpm run verify` and `git diff --check`; record exit codes and counts as observed.
4. Cross-check every cited file exists at the cited commit; record any mismatch instead of smoothing it.

## Progress

- 2026-09-29: initialized the branch off `main` `e185fd6`; no production source, tests, migrations or
  contracts changed. Created this ODD record before any other writing.
- 2026-09-29: read the sibling evidence documents, both iteration logs and issues #22/#71/#72/#73; confirmed
  the merge chain from the local `main` graph and the PR metadata. Ran the focused suites, a forced gate
  (which exposed a flake), the standard gate and `git diff --check`; wrote the evidence document and the
  roadmap state update. Findings below.

## Observed verification results (2026-09-29, Node 24.21.0, tree `e185fd6`)

| Command | Result (as observed) |
| --- | --- |
| `pnpm --filter @vaqcrow/contracts exec vitest run src/assessment-failure-handoff.test.ts src/assessment-handoff-id.test.ts` | exit 0; 2 files passed, 10 tests passed |
| `pnpm --filter @vaqcrow/api exec vitest run src/application/use-cases/route-assessment-failure-to-manual-review.test.ts src/infrastructure/http/routes/application-assessment.route.test.ts src/infrastructure/http/routes/application-manual-review.route.test.ts src/infrastructure/adapters/supabase-application-review-repository.test.ts` | exit 0; 4 files passed, 97 tests passed (28 + 23 + 5 + 41) |
| `pnpm --filter @vaqcrow/web exec vitest run src/state/use-manual-review-context.test.tsx src/presentation/components/human-decision-workspace.test.tsx src/infrastructure/manual-review/http-manual-review-gateway.test.ts src/presentation/components/manual-review-context-panel.test.tsx` | exit 0; 4 files passed, 27 tests passed (6 + 8 + 7 + 6) |
| `pnpm run verify` | exit 0; lint 5/5, typecheck 8/8, test 8/8, build 5/5; contracts 12/344, domain 1/60, ai 5/107, api 42/779, web 101/708; `boundaries` no violations (468 modules, 1406 dependencies); `test:boundaries` 9 files / 93 tests |
| `git diff --check` | exit 0, clean |

The `stderr` lines of the API run are sanitization fixtures (`simulated message for 42501/23514`), not a
remote database. No integration suite, live service, remote Supabase, credential or Stellar Testnet was
used.

## Discrepancies found (logs vs. what was re-run)

1. **`pnpm run verify` is cache-served on a re-run.** The first standard run executed the workspace tests
   and exited 0; later runs report `Cached: 8 cached, 8 total` for the `test` task because the source
   signatures are unchanged (Turbo cache). The counts are real for this tree's inputs but the second and
   third invocations did not re-execute them.
2. **A forced, uncached gate fails on a pre-existing timeout flake unrelated to Feature #22.**
   `pnpm exec turbo run lint typecheck test build --force` exited **1**: `@vaqcrow/api#test` reported
   `3 failed | 776 passed (779)` and the web run showed further timeouts. All failures were
   `Test timed out in 5000ms` (never assertion failures) in files unrelated to the failure flow:
   `campaign.route.test.ts`, `funding-intent.route.test.ts`, `assessment.route.test.ts` (standalone
   `POST /assessments`), `sme-request-form.test.tsx` and `transaction-review-modal.test.tsx`. Re-run in
   isolation they pass: API 3 files / 86 tests, web 2 files / 46 tests. This matches the CPU-load flake
   class already recorded in the #71 log. **No production code, test or config was changed to address it;
   the discrepancy is recorded, not fixed.**
3. **GitHub API field inconsistency for the merges.** `list_pull_requests` returned `"merged": false` for
   PRs #335/#338/#339, while `pull_request_read` (method `get`) returned `"merged": true` with a
   `merged_at`, and issue #71/#72 report their closing PRs as `MERGED`. The local `main` graph is
   authoritative and contains the merge commits `c1a59ff`, `927e923` and `e185fd6`; the evidence document
   reports that state.
4. **Task #71 spanned two PRs, not one.** The brief named PR #338 (`927e923`) as the #71 merge. The real
   chain also includes PR #335 (`c1a59ff`) for `AI-71-01`. Recorded both in the evidence document.

## Files changed by this task

- `docs/planning/ai-failure-routing-evidence.md` (new) — the Feature #22 closure evidence.
- `docs/planning/demo-tasks-list.md` (modified) — #71/#72 changed from `Workflow Backlog` / `Rama
  propuesta` to `Workflow Done` / `Rama e implementación` with PR links; #73 untouched.
- `odd/tasks/document-evidence-for-ai-failure-routing-to-manual-review.md` (new) — this record.

## Rollback boundary

Document-only and isolated: delete `docs/planning/ai-failure-routing-evidence.md`, revert the #71/#72
state lines in `docs/planning/demo-tasks-list.md`, and delete this ODD record. No production module, test,
migration, RPC, contract, dependency or configuration is touched; no runtime boundary exists.

## Engram mirror

**Not written — Engram unavailable.** `mem_current_project` resolved the project as `vaqcrow`
(`project_source: git_remote`), but the `mem_save` call for topic
`odd/document-evidence-for-ai-failure-routing-to-manual-review/tasks` (type `architecture`, scope
`project`, `capture_prompt: false`) failed with `gentle-engram could not confirm Engram session
registration for engram_mem_save; verify that the Engram server is available and retry`, matching the
`ambiguous_active_runtime_sessions` condition reported by the previous writers. No session id was invented
and no write succeeded. **This ODD file is authoritative** for the Task #73 record.

## Next step

- The evidence document and roadmap update are the work unit; this ODD closure is the follow-up `docs(odd)`
  commit. Review and merge the #73 documentation unit; only then can Feature #22 close and #29 unblock.
  #73 (and Feature #22) remain unmerged by this work.
