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
- [ ] T2 — Backend SME request: `POST /sme-requests` + `GET /sme-requests/current` in `apps/api` creating the `application_review` row and returning `applicationId`; web gateway contract aligned; store records `applicationId`. Honor the SME account-provisioning decision (2026-09-22, Engram `planning/sme-account-provisioning`): the request carries the SME-owned public key read from Freighter; Vaqcrow never generates or stores a seed.
- [ ] T3 — Tie AI assessment to the application: send the submitted request's evidence, record the outcome against the application (success → `human_review`, failure → existing manual-review handoff).
- [ ] T4 — Replace `DEMO_APPLICATION_ID` in approval, funding, distribution and evidence with store identifiers; record `campaignId`/`distributionId`; step navigation preserves them (URL stays shareable for evidence).
- [ ] T5 — Option A: link `businessId` ↔ `applicationId`; derive distribution recipients/amounts from sales periods via `calculateRevenueShareObligation`/`allocateRevenueShare` in the prepare use case; retire the recipient fixture from the journey; link the distribution to its campaign.
- [ ] T6 — Seed/reset path for a timed hosted run.
- Follow-up (Task #96): single full-journey Playwright spec with the stub API extended to assessments, decisions and distributions.

## Delivery
- Forecast well above ~400 authored lines → chained PRs. Strategy: `ask-on-risk`; chain strategy chosen by the user on 2026-09-30: **feature-branch-chain**.
- Tracker: `Vaqcrow#30_Feat_Integrate_the_complete_vertical_demo_journey` (draft, no-merge PR to `main`). Child #1: `Vaqcrow#95_Task_Implement_complete_vertical_demo_journey` (T1) → tracker; each later task branch `…-0N-<slug>` is cut from and targets its immediate parent.

| Slice | Branch | Commits | PR |
|---|---|---|---|
| tracker | `Vaqcrow#30_Feat_Integrate_the_complete_vertical_demo_journey` | `6b7f61e` feature plan | pending |
| 1 — T1 | `Vaqcrow#95_Task_Implement_complete_vertical_demo_journey` | `526e6a6` | pending |

## Progress
- 2026-09-30: branch `Vaqcrow#95_Task_Implement_complete_vertical_demo_journey` created from `main`; mapping recorded above.
- 2026-09-30 T1 (delegated writer, uncommitted): installed `zustand` `^5.0.15` in `apps/web` only (lockfile updated). Files: `apps/web/src/state/journey-store.ts` (+ `.test.ts`, 10 tests), `apps/web/src/state/journey-store-provider.tsx` (+ `.test.tsx`, 3 tests), `apps/web/src/app/(demo)/layout.tsx` (provider wraps `DemoShell`). Store holds identifiers only; new applicationId clears campaign/distribution, new campaignId clears distribution, same id is a no-op, empty/whitespace ids throw.
  - RED: both new test files failed at import resolution (`./journey-store` and `./journey-store-provider` did not exist): 2 files failed, 0 tests collected.
  - GREEN: 4 files / 17 tests pass (store, provider, `layout.test.tsx`, `layout.traversal.test.tsx`).
  - Verification: `web typecheck` clean; `web lint` 0 errors (1 pre-existing warning in `fetch-http-client.ts`); `web test` 107 files / 798 tests pass; `pnpm run boundaries` no violations.
  - Commit `526e6a6` (8 files, +237/−3). RDD assessment (`--base-ref dcd4ef5 --committed-only`): risk `medium`, `review_due=false`, reason `under_budget` — stays pending in the slice until a later commit reaches the delivery budget. Reviewed boundary remains `dcd4ef5`.
