# Document evidence for deterministic revenue-share calculation

Iteration log for issue #88 (Task under Feature #27), branch
`Vaqcrow#88_Task_Document_evidence_for_deterministic_revenue_share_calculation`, base `e81e8e8` (merge of
#342, which included #341).

## Objective

Produce the Feature #27 closing evidence in `docs/planning/revenue-share-calculation-evidence.md`, in
Spanish and Obsidian-compatible, traceable to the merged implementation (#86) and its deterministic tests
(#87), with real observed verification results and no sensitive data or unsupported production claims.

## Problem

Feature #27 needs one reportable evidence document before it can close. #86 (PR #341, merge `192b5c1`) and
#87 (PR #342, merge `e81e8e8`) are merged, but the implementation/test record must be consolidated with a
local reproduction, the acceptance criteria mapped verbatim, and the roadmap status corrected for #86/#87.

## Why

`AGENTS.md` and the repo convention: every Feature closes with a Spanish evidence document in
`docs/planning/`, following the sibling structure (e.g. `monthly-sales-feed-evidence.md`), naming the
source of every verification result.

## Scope

In: `docs/planning/revenue-share-calculation-evidence.md`; the roadmap status correction for #86 and #87 in
`docs/planning/demo-tasks-list.md`; this iteration log.

Out: any runtime code, contract, route, migration or test change; closing Feature #27 (a separate later
action).

## Constraints

- Spanish, neutral/professional; acceptance criteria quoted verbatim in English.
- Reproduce the documented checks locally on the merged base; report only observed results.
- No secrets, PII, seeds, unnecessary XDR, Supabase/Testnet/Horizon/LLM usage.
- Delivery strategy: `ask-on-risk`; docs-only, so expected passive.
- Obsidian: keep `[[wikilink|text]]` and `> [!info]`/`> [!important]`/`> [!warning]` callouts.

## Acceptance criteria (verbatim from issue #88)

- Evidence identifies Feature #27, verification commands, and observed results.
- Evidence is traceable to implementation and focused tests.
- Sensitive data and unsupported production claims are excluded.

## Stable checklist

- [x] T88-01 — Sync main, confirm #86/#87 merged and #88 unblocked.
- [x] T88-02 — Re-run the focused suites and `pnpm run verify`; capture observed results.
- [x] T88-03 — Write the Spanish evidence document following the sibling structure.
- [x] T88-04 — Correct the roadmap status for #86/#87.
- [x] T88-05 — Read back the document; confirm traceability and no sensitive data.
- [x] T88-06 — Record proof, rollback boundary, Engram mirror and local work-unit commit.

## Route declaration

- T88-03/T88-04 — delegated direct: one bounded writer (evidence doc + roadmap edit, 2 files).
- T88-02/T88-05/T88-06 — parent: reproduction, readback, RDD assessment and commit.

## Observed evidence

- Base: `e81e8e8` (merge of PR #342, which included merge `192b5c1` of PR #341). Both `#86` and `#87` are
  closed on GitHub and unblock `#88`.
- Reproduced locally on 2026-09-29:
  - `pnpm --filter @vaqcrow/domain exec vitest run src/revenue-share.test.ts` — 1 file, 60 passed.
  - `pnpm --filter @vaqcrow/domain test` — 2 files, 120 passed (60 revenue-share + 60 application-review).
  - `pnpm run verify` — exit 0: lint 5/5, typecheck 8/8, workspace test 8/8, build 5/5,
    `no dependency violations found (470 modules, 1411 dependencies cruised)`, `test:boundaries` 9/93.
    Per package: contracts 12/344, domain 2/120, ai 5/107, web 101/708, api 42/779.
- Spot check: `pnpm --filter @vaqcrow/web run lint` confirms the single pre-existing warning
  `apps/web/src/infrastructure/http/fetch-http-client.ts:8` (`_request` unused, 0 errors).

## Readback evidence

- `docs/planning/revenue-share-calculation-evidence.md`: 115 lines, 3 tables, 3 callouts, 8 sections;
  0 occurrences of `/Users/`, no tokens, seeds, PII or Stellar addresses.
- `docs/planning/demo-tasks-list.md`: exactly 4 substitutions (#86 and #87: `Workflow Backlog → Done` and
  `Rama propuesta → Rama e implementación ... entregada por el PR`); #88 and Feature #27 entries untouched.
- Acceptance criteria §6 mapped verbatim to ✅ PASS with evidence pointers.

## Delivery evidence

- Work unit: `docs(planning): add deterministic revenue-share evidence` (3 files).
- PR: [#343](https://github.com/reyduar/Vaqcrow/pull/343), targets `main` from
  `Vaqcrow#88_Task_Document_evidence_for_deterministic_revenue_share_calculation`, `Closes #88`.
- Engram mirror: this document is mirrored under
  `odd/document-evidence-for-deterministic-revenue-share-calculation/tasks`.

## RDD and review evidence

- RDD is enabled globally; a documentation-only edit is passive. `gentle-ai review assess` over the work
  unit is expected to report `risk: passive`, `review_due: false` — structural readback is the proportional
  check, so no review transaction is opened.

## Rollback boundary

Remove `docs/planning/revenue-share-calculation-evidence.md` and revert the four roadmap substitutions in
`docs/planning/demo-tasks-list.md`; no runtime, contract, route, migration or test change is involved. This
log is the corresponding task record.

## Current next step

Commit and open the #88 PR; after merge, Feature #27 can be closed manually (GitHub does not auto-close the
Feature parent).
