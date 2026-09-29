# Roadmap status sanitation (2026-09-29)

## Objective
Make `docs/planning/demo-tasks-list.md` match the real GitHub state as of 2026-09-29: closed issues struck through, Done workflow with close dates, delivered branches and merged PRs recorded, current "next unit" stated.

## Tasks
- [x] T1 — Close Epics #6 and #8 (100% of sub-issues closed). Closed manually by the user on 2026-09-29 (an automated close was denied by the permission classifier); verified CLOSED via `gh issue view`, and both are now struck in the roadmap.
- [x] T2 — Reconcile the roadmap document. Done by a delegated writer (uncommitted, awaiting review).

## Route
T2: delegated direct writer. Trigger: preparation reading of ~45 roadmap entries plus PR/issue lookups (mapping and preparation triggers).

## What changed (T2)
- Struck the headings of every closed issue that was still unstruck: Epics #3, #4, #5, #7; #26/#83-85, #27/#86-88, #22/#71-73, #28/#89-91, #29/#92-94; #134; the whole contract-custody block (#235-#239, #241-#250, #256, #257). Epic and Olas index tables struck accordingly. Only #6, #8, #9, #10, #30-#34, #95-#109 stay unstruck (open).
- Workflow bullets moved to `Done` with the close date (from `gh issue view`); #6 and #8 show board `Done`, issues still open, pending manual close; #32 and #101 show board `Ready`.
- "Rama propuesta" became "Rama e implementación" with gh-verified PRs and evidence docs for #26, #85, #22, #71, #73, #29, #94, #189 and the custody block (#238 to #249, #250, #256, #257).
- Transversal table: #134 caveat re-verified (no `next-auth`/`authjs`/`@auth/*` reference in apps, packages or package.json); #189 closed by PR #330; #196 closed by PR #331 (RLS policies deferred, decision recorded in `docs/architecture/identity-and-rls-boundaries.md`).
- "Comenzar aquí" rewritten: next unit is Feature #30 (all four blockers #16, #20, #24, #28 closed). "Entregadas en main" extended with #238, #236, #239, #237, #26, #22, #27, #28, #29.
- Header: dated reconciliation note instead of recomputed counts; custody intro corrected (all 21 units are on the board and closed).

## Commits and review
- `10c77c4` docs(planning): reconcile roadmap status with GitHub as of 2026-09-29.
- RDD: native review of that commit (base `563ff38`) closed at START as `low` risk (`non_executable_only`, 0 lenses); lineage `review-b365893ee8afca9a` approved and acknowledged, authority burned.

## Could not verify / caveats
- Task #242 has no PR (environment install; evidence lives in an issue comment per the evidence doc).
- Epic #235 closed 2026-09-26 with no closing PR.
- Header historical counts (42/3/64) were left as history; not recomputed.
- #26, #22, #29 entries do not claim a merged Feature-branch PR; only Task PRs were verified.
- #196 has no dedicated section in the roadmap (table row only).
