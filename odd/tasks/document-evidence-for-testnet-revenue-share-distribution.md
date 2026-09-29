# Document evidence for Testnet revenue-share distribution

Iteration log for issue #91 (Task under Feature #28), branch
`Vaqcrow#91_Task_Document_evidence_for_Testnet_revenue_share_distribution`, base `30c40d6`.

## Objective

Produce the Feature #28 closing evidence in `docs/planning/testnet-revenue-share-distribution-evidence.md`,
in Spanish and Obsidian-compatible, traceable to the merged implementation (#89) and its deterministic
tests (#90), with real observed verification results and no sensitive data or unsupported production claims.

## Problem

Feature #28 needs one reportable evidence document before it can close. #89 (PR #345, merge `bd06df6`) and
#90 (PR #346, merge `30c40d6`) are merged, but the implementation/test record must be consolidated with a
local reproduction, the acceptance criteria mapped verbatim, and the roadmap status corrected for #89/#90.

## Why

`AGENTS.md` and the repo convention: every Feature closes with a Spanish evidence document in
`docs/planning/`, following the sibling structure, naming the source of every verification result.

## Scope

In: `docs/planning/testnet-revenue-share-distribution-evidence.md`; the roadmap status correction for #89 and
#90 in `docs/planning/demo-tasks-list.md`; this iteration log.

Out: any runtime, contract, route, migration or test change; closing Feature #28 and the
`R3-read-model-strictness` follow-up from the #90 review.

## Acceptance criteria (verbatim from issue #91)

- Evidence identifies Feature #28, verification commands, and observed results.
- Evidence is traceable to implementation and focused tests.
- Sensitive data and unsupported production claims are excluded.

## Stable checklist

- [x] T91-01 — Sync main, confirm #89/#90 merged and #91 unblocked.
- [x] T91-02 — Re-run the focused suites and `pnpm run verify`; capture observed results.
- [x] T91-03 — Write the Spanish evidence document following the sibling structure.
- [x] T91-04 — Correct the roadmap status for #89/#90.
- [x] T91-05 — Read back the document; confirm traceability and no sensitive data.
- [x] T91-06 — Record proof, rollback boundary, Engram mirror and local work-unit commit.

## Route declaration

- T91-03/T91-04 — delegated direct: one bounded writer.
- T91-02/T91-05/T91-06 — parent: reproduction, readback, RDD assessment and commit.

## Observed evidence

- Reproduced locally on 2026-09-29 over `30c40d6`: distribution contract 1 file / 143 tests; the
  end-to-end sequence 1 file / 7 tests; the API package 47 files / 944 tests; `pnpm run verify` exit 0
  (lint 5/5, typecheck 8/8, test 8/8, build 5/5, boundaries 498 modules / 1561 dependencies,
  `test:boundaries` 9 files / 93 tests). Per package: contracts 13/487, domain 2/120, ai 5/107, api 47/944,
  web 103/737.
- Readback: the document is 122 lines, eight sections, three tables, four callouts; 0 occurrences of an
  absolute path, a token, a seed or a Stellar secret.
- Roadmap: exactly four substitutions for #89/#90 (`Workflow Backlog → Done`,
  `Rama propuesta → Rama e implementación … PR #345/#346`); #91 and Feature #28 untouched.

## Delivery evidence

- Work unit: `docs(planning): add Testnet distribution evidence` (3 files).
- PR: drafted against `main` from
  `Vaqcrow#91_Task_Document_Evidence_for_Testnet_revenue_share_distribution`.
- Engram mirror: this document is mirrored under
  `odd/document-evidence-for-testnet-revenue-share-distribution/tasks`.

## RDD and review evidence

- RDD is enabled globally; a documentation-only edit over a passive range assesses `passive`
  (`review_due: false`), so structural readback is the proportional check and no review transaction is
  opened.

## Rollback boundary

Remove `docs/planning/testnet-revenue-share-distribution-evidence.md` and revert the four roadmap
substitutions in `docs/planning/demo-tasks-list.md`; no runtime, contract, route, migration or test change
is involved.

## Current next step

Commit and open the #91 PR; after merge, Feature #28 can be closed manually, and #29/#30 become available.
