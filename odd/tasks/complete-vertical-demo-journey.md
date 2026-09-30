# Complete vertical demo journey (#95, Feature #30)

## Objective
Connect the single synthetic SME journey end to end — request → AI assessment → human approval → Freighter funding into the campaign vault → async confirmation → monthly sales → deterministic obligation → Testnet distribution → evidence — so each step consumes the identifiers the previous step produced, in seven minutes or less.

## Problem
Every demo route works in isolation (mapping, 2026-09-30):
- `apps/api` has no SME request endpoint; `http-sme-request-gateway.ts` targets placeholder `/sme-requests` routes and nothing creates an `application_review` row outside the seed.
- `/assessments` is stateless and receives fixture sales, not the submitted request.
- `DEMO_APPLICATION_ID` is hard-coded in the human-decision, campaign, distribution and evidence workspaces.
- The only cross-route hand-off is `?campaign=` / `?distribution=`, and step navigation drops the query string.
- The sales feed (`/businesses/:id/sales-periods`) is never called by the web; distribution amounts come from the frozen `demo-distribution-recipients.ts` fixture.

## Decisions
- **Option A (user, 2026-09-30):** distribution amounts are derived from the SME's monthly sales through the deterministic domain obligation — no frozen recipient fixture in the journey.
- **Zustand scope:** a per-request vanilla store (`createStore`) provided through React context in the demo layout, holding only cross-route client workflow identifiers. Server state stays in SWR; decisions, states and amounts stay backend-authoritative and are never mirrored in the store. Follows the Zustand Next.js guide (no global module store, RSCs never touch it).
- **Dependency gate:** skill/MCP support used for Zustand = `context7` MCP (`/pmndrs/zustand` docs: Next.js setup, `useStore` with scoped stores, testing). No Zustand skill was installed when T1 ran. After T1, the user installed the upstream `zustand` skill (`lobehub/lobehub`, recorded in `skills-lock.json`); `CLAUDE.md`/`AGENTS.md` note that its structural conventions are LobeHub's and that `journey-store.ts` is the repository pattern — later tasks load the skill for technique only.

## TDD
- Mode: strict, enabled. Source: user global configuration (`~/.claude/CLAUDE.md`, "Strict TDD Mode: enabled").
- Runner: Vitest — `pnpm --filter @vaqcrow/web exec vitest run <file>` (web), `pnpm --filter @vaqcrow/api exec vitest run <file>` (api).

## Tasks
- [x] T1 — Install `zustand` in `apps/web`; add the journey store (identifiers only) and its provider mounted in the `(demo)` layout. Route: delegated writer (store, provider, layout, manifest/lockfile: 2+ files).
- [x] T2a — Backend SME request: `sme_request` table (FK to `application_review`, RLS + explicit grants in one migration, tested locally then applied to the remote project), a use case that atomically creates the `application_review` row in `awaiting_assessment` together with the request, and HTTP routes returning the `applicationId`. Idempotent on replay. The SME public key is NOT part of the request: it is captured when the vault opens (decision D7, `20260924132528_add_campaign_sme_account.sql`), which already honors the no-seed rule. Route: delegated writer (migration, port, adapter, use case, route, tests).
- [ ] T2b — Web: align `http-sme-request-gateway.ts` with the T2a contract and record the returned `applicationId` in the journey store on submit.
- [ ] T3 — Tie AI assessment to the application: send the submitted request's evidence, record the outcome against the application (success → `human_review`, failure → existing manual-review handoff).
- [ ] T4 — Replace `DEMO_APPLICATION_ID` in approval, funding, distribution and evidence with store identifiers; record `campaignId`/`distributionId`; step navigation preserves them (URL stays shareable for evidence).
- [ ] T5 — Option A: link `businessId` ↔ `applicationId`; derive distribution recipients/amounts from sales periods via `calculateRevenueShareObligation`/`allocateRevenueShare` in the prepare use case; retire the recipient fixture from the journey; link the distribution to its campaign.
- [ ] T6 — Seed/reset path for a timed hosted run.
- [ ] T1-F — Review follow-ups for the journey store (advisory, non-blocking; fold into T4 before it adds consumers): normalize and validate `createJourneyStore` initial ids (R3-initial-ids-unvalidated, WARNING); decide and test whether `recordCampaign`/`recordDistribution` may run without a parent id (R3-hierarchy-not-enforced); add a `(demo)` layout test with a probe child calling `useJourneyStore` (R3-layout-mount-unasserted).
- Follow-up (Task #96): single full-journey Playwright spec with the stub API extended to assessments, decisions and distributions.

## Delivery
- Forecast well above ~400 authored lines → chained PRs. Strategy: `ask-on-risk`; chain strategy chosen by the user on 2026-09-30: **feature-branch-chain**.
- Tracker: `Vaqcrow#30_Feat_Integrate_the_complete_vertical_demo_journey` (draft, no-merge PR to `main`). Child #1: `Vaqcrow#95_Task_Implement_complete_vertical_demo_journey` (T1) → tracker; each later task branch `…-0N-<slug>` is cut from and targets its immediate parent.

| Slice | Branch | Commits | PR |
|---|---|---|---|
| tracker | `Vaqcrow#30_Feat_Integrate_the_complete_vertical_demo_journey` | `6b7f61e` feature plan | #353 (draft) |
| 1 — T1 | `Vaqcrow#95_Task_Implement_complete_vertical_demo_journey` | `526e6a6`, `7e2516d`, `8674607`, `628dc57` | #354 |

## Progress
- 2026-09-30: branch `Vaqcrow#95_Task_Implement_complete_vertical_demo_journey` created from `main`; mapping recorded above.
- 2026-09-30 T1 (delegated writer, uncommitted): installed `zustand` `^5.0.15` in `apps/web` only (lockfile updated). Files: `apps/web/src/state/journey-store.ts` (+ `.test.ts`, 10 tests), `apps/web/src/state/journey-store-provider.tsx` (+ `.test.tsx`, 3 tests), `apps/web/src/app/(demo)/layout.tsx` (provider wraps `DemoShell`). Store holds identifiers only; new applicationId clears campaign/distribution, new campaignId clears distribution, same id is a no-op, empty/whitespace ids throw.
  - RED: both new test files failed at import resolution (`./journey-store` and `./journey-store-provider` did not exist): 2 files failed, 0 tests collected.
  - GREEN: 4 files / 17 tests pass (store, provider, `layout.test.tsx`, `layout.traversal.test.tsx`).
  - Verification: `web typecheck` clean; `web lint` 0 errors (1 pre-existing warning in `fetch-http-client.ts`); `web test` 107 files / 798 tests pass; `pnpm run boundaries` no violations.
  - Commit `526e6a6` (8 files, +237/−3). RDD assessment (`--base-ref dcd4ef5 --committed-only`): risk `medium`, `review_due=false`, reason `under_budget` — stays pending in the slice until a later commit reaches the delivery budget. Reviewed boundary remains `dcd4ef5`.
- 2026-09-30 zustand skill installed by the user (`7e2516d`); feature doc updated (`8674607`). RDD on the slice `dcd4ef5..8674607` (`--committed-only`): risk `medium`, `review_due=true` (`slice_budget_reached`, 18 files / 1282 lines, mostly vendored skill docs). User granted consent; lens `review-reliability`; lineage `review-776bffd5e3fbeead` **approved** and acknowledged (authority burned). Three advisory findings recorded as T1-F. Reviewed boundary advances to `8674607`.
- 2026-09-30 T2a (delegated writer, uncommitted; route: delegated writer, trigger 2+ non-trivial files; remote apply pending (parent)): backend SME request.
  - Migration `supabase/migrations/20260930130000_create_sme_request.sql` (written as `20260930123752_…`, renamed to the version the remote recorded): table `public.sme_request` (PK/FK `application_id` -> `application_review` on delete cascade; `sme_reference`, `declared_total_ars numeric >= 0`, `period_start`/`period_end` `YYYY-MM` checks + order check, `correlation_id` unique, `created_at`); RLS + `revoke all from anon, authenticated, service_role` + `grant select, insert to service_role` (service_role added by the parent, see remote entry) in the same migration; RPC `submit_sme_request(uuid, uuid, text, numeric, text, text)` (security invoker, `search_path = ''`, execute only for service_role, advisory lock on the correlation id) inserting `application_review` (`awaiting_assessment`) and `sme_request` atomically; replay of the same correlation id returns the existing application (`replayed`).
  - Code: contracts `smeRequestSubmissionSchema` / `smeRequestReadSchema`; port `sme-request-repository-port.ts`; adapter `supabase-sme-request-repository.ts`; use cases `submit-sme-request.ts` (server-side uuid, contract validation -> sanitized `{ field, code }` errors) and `get-sme-request.ts`; routes `sme-request.route.ts` (`POST /sme-requests` 201/200, `GET /sme-requests/:applicationId`), wired in `build-app.ts` and `index.ts`. `GET /sme-requests/current` intentionally not kept (web realigned in T2b).
  - Decisions: (1) idempotency key = the request correlation id (the transport request id). The server generates it per request, so an HTTP-level replay needs a client-supplied key: gap, see below. (2) Validation codes reuse the web vocabulary (`required`, `out_of_range`, `invalid_format`, `before_start`; `invalid` otherwise); the period-order issue is suppressed when another issue exists. (3) `simuladoLabel` is a contract constant, not a column.
  - Finding, businessId vs smeReference: the simulated sales provider only accepts `businessId = "panaderia-horizonte"` (`DEMO_BUSINESS_ID`), while the web submits `smeReference = "sme:SYN-PH-0001"`. `GET /sme-requests/:applicationId` passes `smeReference` to the provider; today that is `not_found`, which the use case reports as an empty `salesPeriods` list (declared absence). No mapping was invented; the linkage is T5 (needs a product decision).
  - RED: contracts test failed 5/5 (exports missing); use-case test failed at import; adapter test failed at import; route test failed 9/9 (route/dependency missing). The pgTAP file was written after the migration (SQL, no separate RED observed).
  - GREEN: contracts 14 files / 492 tests; api 50 files / 994 tests (new: use cases 15, adapter 9, route 9); pgTAP 3 files / 59 tests (`sme_request.sql` 18).
  - Verification: `pnpm run verify` pass (lint 0 errors, typecheck, test, build, boundaries no violations, test:boundaries 93 tests); `pnpm run test:db` pass.
  - Local apply: `supabase migration repair --local --status reverted 20260928120000` (stale history stamp of the handoff migration), `--status applied 20260928235908` (objects already present locally), then `supabase migration up --local` (applied `20260929170119` and `20260930123752`). No reset, no data loss.
- 2026-09-30 T2a remote apply (parent, inline; user authorized the plan and added the permission rules):
  - Found the remote project behind the repository: `create_revenue_share_distribution` (#28, merged) had never been applied. Applied it first with `apply_migration` so history keeps repository order; the remote recorded `20260930124915`, and the repo file was renamed from `20260929170119_…` to match (evidence doc path updated).
  - Grant fix before the remote apply: `sme_request` revoked only from anon/authenticated, leaving Supabase's default broad `service_role` grants, so a submitted request was mutable. RED: two new pgTAP assertions (`service role cannot rewrite/delete a submitted request`) failed 2/20 (`have: true`). Fix: add `service_role` to the `revoke all`. Local re-apply (drop objects in `supabase_db_vaqcrow`, repair history, `migration up --include-all`); GREEN: `pnpm run test:db` 3 files / 61 tests pass.
  - Applied `create_sme_request` to the remote; recorded version `20260930130000`, repo file renamed to match; local history repaired to the same versions (`supabase migration list --local` shows local = remote for all 11).
  - Remote verification: RLS enabled on `sme_request`, `revenue_share_distribution`, `revenue_share_distribution_recipient`; anon/authenticated have no privileges; service_role has exactly INSERT, SELECT on the three tables; `submit_sme_request` executable only by service_role; `md5(pg_get_functiondef)` identical local vs remote (`35f1e9df…`). Security advisors: only `rls_enabled_no_policy` (INFO) on the 10 service-role-only tables — the accepted pattern tracked by #196.
  - Accepted limitation: request creation is not idempotent across HTTP retries — the correlation id is server-generated (`requestIdHeader: false`, `build-app.ts`), like every route; a resubmission is a new case and the journey store already clears stale downstream ids. T2b disables submit while in flight.
  - Open gap for T5: the sales-feed provider only knows `businessId = "panaderia-horizonte"` while the request carries `smeReference = "sme:SYN-PH-0001"`, so `GET /sme-requests/:applicationId` returns empty `salesPeriods` until T5 decides the mapping.
