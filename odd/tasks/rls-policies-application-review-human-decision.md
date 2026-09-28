# RLS policies for application_review and human_decision (issue #196)

## Objective
Resolve GitHub issue #196: `public.application_review` and `public.human_decision` both have RLS enabled with zero policies. Record the explicit decision (policies now, or a documented "no policies yet" with the advisor finding acknowledged), cover both tables, and add a deterministic guard so a future GRANT to `anon`/`authenticated` cannot land silently.

## Why this is a decision, not a fix
An RLS policy needs a **subject** — `auth.uid()`, a JWT claim, a role. This repository has no auth layer today: no Auth.js, no session, no `auth.uid()`. The only caller is the API as `service_role`, which bypasses RLS. Writing a policy now would invent a security model with no identity to key it on, and a `using (true)` policy would turn an INFO advisory into a real hole while looking fixed. So the issue's own two endings apply.

## Decision (owner, 2026-09-28)
The identity model **is** coming, so the resolution is the issue's **option 2**: identity→row policies will exist, but are **deferred** until an identity model exists. The owner declared three access levels — **Admin** (administrative module; not SME or investor), **Inversor** (marketplace visitor), **PyME** (wants to receive investment) — mapped in the record onto `docs/design/demo-ui.md` §3/§4 persons: Admin ↔ `Operador/admin`; `Visitante` is unauthenticated; `Evaluador/observador` is the tribunal persona, not an authenticated level. The mapping is stated as the applied reading so a human can correct it.

Consequences recorded: the policies become a Task under whatever Feature introduces the identity, with `docs/architecture/identity-and-rls-boundaries.md` as the prerequisite; the advisor finding is accepted at INFO; **no claim that authentication exists**.

## Scope / non-goals
- In scope: the recorded decision (new architecture doc), a deterministic containment guard, and fixing the two wrong `#134` pointers in `docs/planning/human-assessment-and-approval-evidence.md`.
- No migration, no schema change, nothing applied to the hosted Supabase project, no new dependency.
- Not in scope: writing any RLS policy; the four *other* tables the advisor now flags (§ Findings).

## Tasks
- [x] T1 Decision record `docs/architecture/identity-and-rls-boundaries.md` (Spanish, matches the corpus: frontmatter, callouts, tables, wikilinks).
- [x] T2 Guard `tests/rls-grants-containment.test.ts` (derived from `supabase/migrations/*.sql`, non-vacuous).
- [x] T3 Fix pointers in `docs/planning/human-assessment-and-approval-evidence.md` (lines 70 and 101) to `#196` + the new record.

## Guard design
Walks `supabase/migrations/*.sql` in filename order, strips line comments, splits on `;`, lowercases and collapses whitespace, then asserts for `application_review` and `human_decision`:
1. a `revoke ... from a list containing both anon and authenticated` exists on the table — asserted to be found, so the test cannot pass vacuously;
2. no `grant ... on public.<table> ... to` list contains `anon` or `authenticated`.

Derived from the files (no hardcoded migration filenames), and it does not assert on prose — comments are stripped first. `targetsTable` uses `\bon\s+public\.<table>\b` so `human_decision` cannot match a longer identifier and a function grant (`on function public.record_human_decision`) is not mistaken for a table grant.

## Evidence

Focused baseline (GREEN before the probes):
```sh
$ npx vitest run tests/rls-grants-containment.test.ts
 ✓ tests/rls-grants-containment.test.ts (8 tests) 2ms
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

### Non-vacuity probe (RED then GREEN, migration restored between)
Backed up both migrations to the session temp dir, broke the premise in the working-tree migration, ran the test, then restored and confirmed the tree was clean (`git diff --stat -- supabase/` empty).

**Probe A — revocation removed** (`revoke ... from anon, authenticated` → `from service_role`):
```
 ✗ the scanned migration set > covers the migrations, so a clean result means something
   → no migration revokes access to `public.application_review` from anon/authenticated.
     Without that revocation the table relies on an absent grant for containment; if it is gone,
     this test would pass vacuously.: expected 0 to be greater than or equal to 1
 Test Files  1 failed (1)
      Tests  1 failed | 7 passed (8)
```
**Probe B — forbidden grant added** (`grant select on public.human_decision to anon;`):
```
 ✗ grant containment > grants nothing on application_review or human_decision to anon or authenticated
   → a migration grants one of the RLS-enabled tables to anon/authenticated:
     20260919181453_create_human_decision_audit.sql: grant select on public.human_decision to anon.
 Test Files  1 failed (1)
      Tests  1 failed | 7 passed (8)
```
**Restore (GREEN):**
```
$ npx vitest run tests/rls-grants-containment.test.ts
 Test Files  1 passed (1)
      Tests  8 passed (8)
EXIT_CODE: 0
```

### Gates
```sh
$ pnpm run test:boundaries
 Test Files  8 passed (8)
      Tests  91 passed (91)
EXIT_CODE: 0

$ npx eslint tests/rls-grants-containment.test.ts
EXIT_CODE: 0   # no findings

$ pnpm run verify
$ depcruise apps/*/src packages/*/src --config .dependency-cruiser.cjs
✔ no dependency violations found (438 modules, 1293 dependencies cruised)
$ vitest run
 Test Files  8 passed (8)
      Tests  91 passed (91)
EXIT_CODE: 0
```
`pnpm run verify` ran lint → typecheck → test → build → boundaries → test:boundaries and exited 0 on the working tree; boundaries clean at 438 modules / 1293 dependencies; the guard is included in the root `test:boundaries` suite (8 files, 91 tests).

## Findings
- **The advisor was re-readable on 2026-09-28, and its count is 6, not 2.** The orchestrator's brief said the advisors endpoint returned `Unauthorized`; against this session it responded, so the record was corrected rather than repeating the stale premise. `rls_enabled_no_policy`, level **INFO**, **count 6**: the two tables in scope (`application_review`, `human_decision`) plus four later arrivals with the same shape — `campaign`, `campaign_contribution`, `campaign_refund_contact`, `funding_intent_legacy`. The four extra tables' migrations also revoke from `anon, authenticated` before granting only to `service_role`, so the GRANT mechanism contains them today, but they are **outside #196's scope** and **not covered by the guard**. Recorded in the decision doc §5 as a follow-up signal, not silently absorbed.
- The mechanism is unchanged from the issue: nothing is exposed today; Postgres answers `42501` at the GRANT layer before RLS is evaluated; `service_role` is the only application role.

## Deviations
1. **Advisor count 2 → 6, and the "could not re-read" note replaced by a re-verified result.** The brief asserted the endpoint was Unauthorized and said to state that plainly. It answered in this session, so stating it was unread would have been false; the doc now records the real count and names the four extra tables. Reason: honest, verified evidence beats repeating an unverified premise.
2. **The guard covers exactly the two in-scope tables, not the four extra ones.** The two tables are what #196 names and what the acceptance criteria require. Extending the guard to the campaign/funding tables is a scope change to Features that already own their migrations; the finding is recorded instead.
3. **Non-vacuity was probed twice (revocation removed, and forbidden grant added), not once.** One break proves non-vacuity of assertion 1; a second proves assertion 2 actually bites. Both migrations were restored and the `supabase/` tree confirmed clean.

## Next step
- Commit the three work units separately (decision record + fixed pointers; guard with its probe evidence; this ODD log), then open the PR against `main`.
- When an identity model is chosen (or `#134`'s eventual implementation lands), write the policies as a Task under that Feature, using `docs/architecture/identity-and-rls-boundaries.md` §1–§5 as the prerequisite, and extend the guard's table list only if those four additional tables are brought into scope.
