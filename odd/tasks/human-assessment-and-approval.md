# Human assessment and approval (issue #62)

## Objective
Implement GitHub issue #62 end to end: explicit human approve / changes_requested / reject decision with auditability, backend authority, idempotency and honest simulation boundaries. AI never decides.

## Constraints
- Node 24 required: prefix commands with `PATH="/opt/homebrew/opt/node@24/bin:$PATH"`.
- Artifacts/code/tests/docs in English. Conventional commits, no AI attribution.
- Feature Branch Chain with tracker PR; ~400 authored lines per work unit (heuristic).
- approved => positive safe-integer approvedLimitArs; others => null.
- Integration suite (`test:integration`) is credential-gated: never run with fabricated creds.
- TDD: strict mode enabled (runner: vitest via pnpm).
- RDD: on (global). Delivery strategy: chain (Feature Branch Chain).

## Tasks
- [x] T1 Contract/domain invariants — a2ee438
- [x] T2 Atomic Supabase migration + RPC — b879602
- [x] T3 Repository adapter — 9b63a8e
- [x] T4 API use case + HTTP route — 0552b2f
- [x] T5 Integration tests + FK cascade migration — d4a8a2b; native review approved + acknowledged (medium, range f044f2c..d4a8a2b); reviewed boundary = d4a8a2b
- [x] T6 Assessment and approval web UI — c2c3d6e (app logic/gateway/state), 268d35a (screens), 2e57ec1 (fix: fresh attempt after idempotency_conflict, RED->GREEN observed). Route: delegated writer (sonnet). Native review approved+acknowledged for d4a8a2b..268d35a and for full branch f044f2c..268d35a (both medium). 2e57ec1 assessed: medium, 26 lines, under_budget, no review due. UI copy is Spanish (matches existing web copy + demo-ui.md).
- [x] T7 Migrations applied to the HOSTED Supabase project via MCP (no local Docker, ever): create_human_decision_audit, cascade_human_decision_on_application_delete, enforce_human_decision_grant_immutability (6880eb9, branch -07-audit-immutability, under_budget, no review due). Remote SQL probe (rolled back): RPC applied, service_role update/delete denied, cascade cleans audit. Live integration suite not run: no credentials in this environment. — `pnpm run verify` passed on 268d35a (web 317 tests after fix, boundaries clean)
- [x] T8a Evidence doc docs/planning/human-assessment-and-approval-evidence.md — branch -08-evidence-doc, docs-only passive, no review. Route: delegated writer (sonnet); parent verified adapter error sanitization, issue refs #63/#64/#134, and softened 5 inferred advisory notes.
- [x] T8b Pushed 9 branches; tracker PR #166 (draft, base main) + child PRs #167-#174, each targeting its immediate parent. Web UI split into 2 PRs (#171 840 lines, #172 720 lines; size:exception recommended, not applied). User authorized push+PRs. Accumulated branch native review approved+acknowledged at 6880eb9.

## Progress / evidence
- 2026-09-19: T1-T4 done in prior session. T5 files reviewed, commit pending.

## Next step
T6 web UI on branch -06-web-ui: route = delegated writer (4+ files to read, 2+ non-trivial files). Reviewed boundary d4a8a2b.
Advisories (non-blocking, later work; R3-idem-conflict-retry FIXED in 2e57ec1): R3-zod-parse-throw-state-conflict (adapter L209-215), R3-route-no-repo-404 (build-app L32-34), R3-sql-invariant-not-tested (migration L96-102).
