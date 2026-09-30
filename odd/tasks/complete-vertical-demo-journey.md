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
- **Dependency gate:** skill/MCP support used for Zustand = `context7` MCP (`/pmndrs/zustand` docs: Next.js setup, `useStore` with scoped stores, testing). No Zustand skill is installed in `.atl/skill-registry.md`.

## TDD
- Mode: strict, enabled. Source: user global configuration (`~/.claude/CLAUDE.md`, "Strict TDD Mode: enabled").
- Runner: Vitest — `pnpm --filter @vaqcrow/web exec vitest run <file>` (web), `pnpm --filter @vaqcrow/api exec vitest run <file>` (api).

## Tasks
- [ ] T1 — Install `zustand` in `apps/web`; add the journey store (identifiers only) and its provider mounted in the `(demo)` layout. Route: delegated writer (store, provider, layout, manifest/lockfile: 2+ files).
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
| tracker | `Vaqcrow#30_Feat_Integrate_the_complete_vertical_demo_journey` | feature plan | pending |
| 1 — T1 | `Vaqcrow#95_Task_Implement_complete_vertical_demo_journey` | pending | pending |

## Progress
- 2026-09-30: branch `Vaqcrow#95_Task_Implement_complete_vertical_demo_journey` created from `main`; mapping recorded above.
