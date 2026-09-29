# Document evidence for evidence dashboard

Iteration log for issue #94 (Task under Feature #29), branch
`Vaqcrow#94_Task_Document_evidence_for_evidence_dashboard`, base `db3de55` (the merge of #350).

## Objective

Produce the Feature #29 closing evidence in `docs/planning/evidence-dashboard-evidence.md`: Spanish,
Obsidian-compatible, traceable to the merged implementation and its focused tests, with a fresh local
reproduction on this base and no sensitive material or unsupported production claims.

## Problem

Feature #29 has no closing document. #92 (PR #349, merge `bfe68e1`) implemented the dashboard and #93
(PR #350, merge `db3de55`) proved it, but the acceptance criteria of neither Task are mapped anywhere, the
implementation is not consolidated in one traceable place, and the roadmap still shows #92/#93 as
`Backlog`. Without #94 the Feature cannot close.

## Why

The repository convention is explicit: every Feature closes with a Spanish evidence document under
`docs/planning/`, following the established sibling structure, mapping each acceptance criterion verbatim
and naming the source of every verification result. #94 is that document for Feature #29.

## Scope

In:

- `docs/planning/evidence-dashboard-evidence.md` — new, following `monthly-sales-feed-evidence.md`'s
  structure (contexto, cómo leer, implementación trazable, cobertura determinística, resultados observados,
  mapeo de criterios verbatim, límites y trabajo futuro, estado de entrega) with callouts and wikilinks.
- `docs/planning/demo-tasks-list.md` — the roadmap status of #92 and #93 (`Workflow Backlog` →
  `Workflow Done`, `Rama propuesta` → `Rama e implementación … PR #349/#350`). #94 and Feature #29 stay as
  they are: this document does not claim its own delivery.
- This log.

Out:

- No runtime, contract, route, migration, test or fixture change; nothing under `apps/` or `packages/`.
- No claim that Feature #29 is closed, that any Testnet transaction ran for this document, or that the demo
  is production-ready.
- No secrets, tokens, seeds, PII, unnecessary XDR, absolute paths or live-service data.

## Acceptance criteria (verbatim from issue #94)

- Evidence identifies Feature #29, verification commands, and observed results.
- Evidence is traceable to implementation and focused tests.
- Sensitive data and unsupported production claims are excluded.

## Stable checklist

- [ ] T94-01 — Re-run the documented checks on this base and capture the real output.
- [ ] T94-02 — Write `docs/planning/evidence-dashboard-evidence.md` following the sibling structure.
- [ ] T94-03 — Map the acceptance criteria verbatim (Feature #29, #92, #93 and #94) with their evidence.
- [ ] T94-04 — Sync the roadmap status of #92 and #93, leaving #94 and #29 untouched.
- [ ] T94-05 — Read back the document: traceability, no sensitive material, no unexecuted claim.
- [ ] T94-06 — `pnpm run verify`, mirror, work-unit commit recorded.

## Route declaration

- T94-01 … T94-05 — delegated direct: one bounded writer (reproduction + document + roadmap).
- T94-06 — parent: closure gate, readback, RDD assessment, commit, push and PR.

## Design decisions

- **D1 — The sibling with the same shape wins.** `monthly-sales-feed-evidence.md` closes a Feature whose
  three Tasks are implement/test/document, exactly like #92/#93/#94, so its structure is followed rather
  than invented.
- **D2 — Every number has a source.** Verification results are re-run on `db3de55` and quoted from the real
  output; the flake this repository documents is reported if it appears again, never smoothed over.
- **D3 — The truthfulness limits are part of the evidence.** What the dashboard deliberately does *not*
  show — the AI assessment, a per-transaction explorer link the API does not derive, a success tone — is
  recorded as a limit, because the Feature's own criterion is that failure and absence stay truthful.
- **D4 — The review record is reported as it is.** #92 has two approved-and-acknowledged lineages; #93's
  reviewer returned empty three times and its transaction stayed `reviewing`. The document states both,
  rather than implying a receipt it does not have.

## Review workload forecast

Authored changed lines: **≈330–420** (one new document of ~230–300 lines, a roadmap line pair, this log).
Documentation only, so the RDD assessment is expected to be `passive`; one PR from
`Vaqcrow#94_Task_Document_evidence_for_evidence_dashboard`.

## Observed evidence

Every result below was observed in this working tree, on this branch, on 2026-09-29. No Supabase, Testnet,
Horizon, LLM or credential was needed.

- Reproduction over `db3de55`, before the document was written: API focused (route + adapter) **2 files /
  69 tests passed**; web focused (projection + two component suites + two route suites) **9 files / 90 tests
  passed**; local-only Playwright **19 passed in 27.8s**; `pnpm run verify` **exit 0** — lint 5/5,
  typecheck 8/8, test 8/8, build 5/5, boundaries `506 modules / 1608 dependencies, no violations`,
  `test:boundaries` 9 files / 93 tests.
- The gate served turbo cache for lint/typecheck/test/build (docs-only change, source inputs unchanged), so
  the per-package counts were independently re-confirmed fresh: `@vaqcrow/web` **105 files / 785 tests**,
  `@vaqcrow/api` **47 files / 961 tests**, both exit 0 and matching the gate's own report.
- The documented load flake appeared in an extra forced-fresh run, not in any required command: with host
  load **19.38** the first test of `distribution-workspace.test.tsx` exhausted 5000 ms, and with load
  **9.58** the first tests of `layout.traversal.test.tsx` and `theme-switcher.test.tsx` did too. Isolated
  re-runs: **9 tests in 1002 ms** and **8 tests in 3.39 s**. No assertion failed and no `testTimeout` was
  changed.
- Readback by the parent found one imprecise claim and corrected it: the criteria row for #92's second
  criterion asserted that **neither** snapshot exposes an operation list. Only the campaign's does not —
  the distribution's `recipients` *are* the envelope's payment operations and the recap lists them with
  their amounts — so the partial verdict now rests on the vault movement alone (`dcce416`).
- Stale-claim sweep: `rg` over `docs/` found three documents asserting that `/evidence` (and, in two of
  them, `/distribution`) were placeholders. Each was corrected with a dated note that preserves the
  original wording as history; `DEMO.md`/`demo-ui.md` (prospective) and `stellar-blockchain-requirements.md`
  (scope) were deliberately left alone. Recorded in §7.1 of the document, including the negative result.

## Delivery evidence

- Work units: `56f5808` `docs(planning): add evidence dashboard Feature evidence` (5 files: the new
  document, the roadmap sync for #92/#93 and three dated notes); `dcce416`
  `docs(planning): sharpen the operations verdict in the #29 evidence`; plus this log commit.
- Delivery strategy: one PR from `Vaqcrow#94_Task_Document_evidence_for_evidence_dashboard`. Documentation
  only — no `size:exception` is involved and no runtime surface changed.
- Engram mirror: this document, under `odd/document-evidence-for-evidence-dashboard/tasks`.

## RDD and review evidence

RDD is enabled globally. The range from `db3de55` assessed **`passive`** — `reasons: [non_executable_only]`,
**6 changed paths / 317 changed lines** — with **`review_due: false`**, reason `passive`. This unit is
documentation only, so no reviewer, consent envelope, refuter, correction or validator was involved and no
receipt was created: that is the contract's own outcome for a passive candidate, not a skipped gate. The
proportional check is the structural readback recorded above — the parent read the document back, verified
the cited paths, and corrected the one imprecise criterion verdict — plus the re-run of the checks the
document cites.

## Rollback boundary

Remove `docs/planning/evidence-dashboard-evidence.md`, revert the roadmap substitutions for #92/#93 and this
log. No runtime, contract, route, migration or test change is involved.
