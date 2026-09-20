# Documentation state and agent guidance

## Objective

Synchronize the executable roadmap and project README with the delivered human-approval slice, then add repository guidance for agents based on `CLAUDE.md`.

## Problem

The implementation and evidence on `main` have advanced beyond the roadmap and README, while the repository has no `AGENTS.md` entry point.

## Authorized scope

- Update `docs/planning/demo-tasks-list.md` status and roadmap entry points.
- Update `README.md` current-state, testing, and next-step claims.
- Create `AGENTS.md` from the repository guidance in `CLAUDE.md`.
- Do not change application code, backlog scope, or remote GitHub state.

## Route

Delegated direct documentation edit. Evidence: three non-trivial documentation artifacts require coordinated consistency.

## Checklist

- [x] Reconcile roadmap counts and #19/#62/#63/#64 delivery state with local evidence.
- [x] Reconcile README test counts, implemented capabilities, and next step.
- [x] Create `AGENTS.md` with equivalent repository guidance from `CLAUDE.md`.
- [x] Review the diff and run documentation-focused checks.
- [x] Commit the work as one conventional work unit.

## Acceptance criteria

- No stale claim says the human approval slice is merely Ready/Backlog.
- README distinguishes implemented behavior from planned capabilities and keeps the non-production boundary.
- `AGENTS.md` is present and preserves the operational constraints in `CLAUDE.md`.
- Markdown remains valid and the repository working tree contains only this work before commit.

## Verification

- `git diff --check`
- Inspect changed Markdown and `git diff --stat`

## Progress

- Source edits completed by the delegated documentation writer; `AGENTS.md` is byte-for-byte equal to `CLAUDE.md`.
- `git diff --check` passed.
- Work-unit commit: `eb11a49` (`docs: synchronize project guidance and roadmap`).
- **2026-09-20 — resolution of the dangling branch (option B).** The commit was never pushed and had drifted stale in two places, so it was corrected and amended (not amended blindly: the corrections are verified, not cosmetic):
  - README said "72 archivos de test"; re-derived with `find` → **74** (7 api + 59 web + 1 domain + 5 contracts + 2 boundary). The two missing ones were the boundary tests the same sentence claims to cover.
  - README + `demo-tasks-list.md` said **#47 was "pausada hasta nuevo aviso"**. False once #47's implementation landed in PR #176. Both places now record #47 as `Ready` with its implementation delivered in PR #176, pending merge; the `#47` section gained an `Entrega` line and switched to `Rama e implementación`, matching the file convention for delivered units.
  - Board counts (75 `Backlog` / 2 `Ready` / 31 `Done`) left unchanged: they were already consistent with #47 back in `Ready`.
- Conflict check before pushing: `main...HEAD` = `0 1` (clean fast-forward, no rebase needed) and `git merge-tree --write-tree <#47 branch> <this branch>` → exit 0, clean tree. **No conflicts with PR #176 in either merge order.**
- Amended commit `30f2202` (author preserved); pushed as `origin/docs/documentation-state-and-agent-guidance`.

## Next step

PR [#177](https://github.com/reyduar/Vaqcrow/pull/177) (base `main`, label `area:docs`, MERGEABLE). No linked issue — docs-only sync, same pattern as PR #175. Merge order relative to #176 is free.

