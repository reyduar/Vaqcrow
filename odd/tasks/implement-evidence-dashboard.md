# Implement evidence dashboard

Iteration log for issue #92 (Task under Feature #29), branch
`Vaqcrow#92_Task_Implement_evidence_dashboard`, base `6334250`.

## Objective

Make `/evidence` render one correlated timeline of the demo run — the synthetic case, the recorded human
decision, the campaign-vault movement and the revenue-share distribution movement — with states, amounts,
hashes, operations, Testnet explorer links and simulation disclosures, so a step that is pending, failed or
absent is never presented as success.

## Problem

`apps/web/src/app/(demo)/evidence/page.tsx` is `StepTrustDisclosures` + `StepPlaceholder`
("Step content coming soon"). The demo script closes on the dashboard (`DEMO.md` §9, 5:45–6:30:
"Dashboard, límites y siguiente paso — Dos hashes, trazabilidad completa") and `DEMO.md` §10 requires that
both movements show hash, operations and a Testnet explorer link. The read surfaces the timeline needs are
partly missing: `GET /campaigns/:campaignId` and `GET /revenue-share-distributions/:distributionId` exist,
but the human decision is write-only (`POST /application-reviews/:applicationId/decisions` has no GET and
`ApplicationReviewRepositoryPort` has no decision read method), and `/distribution` never carries its
distribution id anywhere, so `/evidence` cannot reach the distribution hash.

## Why

Feature #29 (`Expose decision and transaction evidence dashboard`, High, area `demo`) is now unblocked:
#19 is delivered, #22 and #28 are closed. Its first Task is this one, and the roadmap names
`Vaqcrow#92_Task_Implement_evidence_dashboard` as the implementation unit. The parent orchestration
authorized the minimal additional read surface needed for a truthful timeline (user decision, 2026-09-29).

## Scope

In:

- `packages/contracts`: reuse `humanDecisionRecordSchema` as the read shape; no new schema.
- `apps/api`: a read for the **latest recorded human decision** of an application — repository port method,
  Supabase adapter, Fastify route — plus its deterministic tests.
- `apps/web`: the `/distribution` page carries its distribution id in the URL (mirroring `/funding`'s
  `?campaign=` convention and its explicit "no `localStorage`" rule); a read method on the human-decision
  gateway; a pure timeline projection in `application/`; the `/evidence` page and its container.
- Tests: API route/repository tests with doubles, web unit/component tests, and keeping the existing
  Playwright journey green.

Out:

- No new Supabase migration: `20260919181453_create_human_decision_audit.sql` already
  `grant select, insert on public.human_decision to service_role`, and `application_review` already carries
  the state.
- No deterministic revenue-share HTTP route and no change to the deterministic engine; the web keeps
  displaying the rule version under its `SIMULADO` label.
- No read surface for the AI assessment (it is stateless / not persisted); the timeline does not claim to
  show one.
- No change to the funding page, the wallet ports, the campaign contract, or any Testnet/Horizon behaviour.

## Acceptance criteria (verbatim from issue #92)

- Feature #29 behavior is implemented within its documented boundary.
- Display a correlated timeline of decisions, transaction states, amounts, hashes, operations, and Testnet
  explorer links while keeping simulated and real evidence clearly distinguished.
- Failure paths remain truthful and do not weaken security or human-control boundaries.

## Stable checklist

- [ ] T92-01 — Read surface: `readLatestHumanDecision` on the repository port, its Supabase implementation,
      and `GET /application-reviews/:applicationId/decisions`; deterministic tests.
- [ ] T92-02 — Web: human-decision gateway read + `application/evidence/build-evidence-timeline.ts` (pure
      projection, no I/O) with its unit tests.
- [ ] T92-03 — Web: `/distribution` carries `?distribution=` in the URL, so the hash survives navigation.
- [ ] T92-04 — Web: `/evidence` page + `EvidenceWorkspace` container rendering the timeline with `Badge`,
      `HashDisplay` and `DistributionCalculation`; component tests for complete, pending and failed evidence.
- [ ] T92-05 — e2e impact check: the guided journey and campaign-vault suites still pass.
- [ ] T92-06 — `pnpm run verify` at closure, readback, Engram mirror, work-unit commits recorded.

## Route declaration

- T92-01 … T92-04 — delegated direct: one bounded writer per unit, in order, with the exact skill paths and
  the verification commands to run in the foreground.
- T92-05/T92-06 — parent: run the checks, read back the artifacts, record the decision and commit identity.

## Design decisions

- **D1 — The web never builds an explorer URL.** Every hash rendered carries the URL the API supplied
  (`campaignSnapshot.explorerUrl`, `revenueShareDistributionSnapshot.explorerUrl`), the existing "the API
  supplies the link" rule; `HashDisplay` takes a caller-supplied URL and derives nothing.
- **D2 — Latest decision read reuses the existing contract.** `GET /application-reviews/:applicationId/decisions`
  answers `{ decision: HumanDecisionRecord }`, or `404 { code: "not_found" }` when the application has no
  recorded decision yet — a declared absence, never an empty success.
- **D3 — Identity travels in the URL, not the browser.** `/distribution` writes `?distribution=<id>` the same
  way `/funding` writes `?campaign=<id>`, so `/evidence?campaign=…&distribution=…` is reloadable and there is
  no `localStorage` state to go stale.
- **D4 — One pure projection owns the truthfulness rules.** `build-evidence-timeline.ts` maps each observed
  source to an ordered entry and is the only place that decides what a state means; it performs no I/O, so it
  is fully unit-testable and Task #93 can extend it.
- **D5 — An absent source is a declared absence.** No id in the URL, or a source that answers `not_found`,
  renders as "no se ejecutó en esta sesión" / "no hay registro", never as an empty success.
- **D6 — No success signal is invented.** `Badge` keeps its tone vocabulary (no `success` member) and the
  timeline reuses the already-built, currently unused `HashDisplay` and `DistributionCalculation` instead of
  adding new presentational primitives.

## Review workload forecast

Authored changed lines (additions + deletions), generated files excluded: **≈900–1,100** across
`packages/contracts` (0), `apps/api` (≈300 with tests), and `apps/web` (≈600 with tests). That is over the
~400-line delivery budget, so the delivery strategy is decided before the second work unit; see
"Delivery strategy".

## Delivery strategy

**`exception-ok` — one PR with a maintainer-approved `size:exception`**, chosen by the owner on
2026-09-29 after seeing the forecast (the same choice made for #83). No chained split; every work unit lands
as a commit on `Vaqcrow#92_Task_Implement_evidence_dashboard` and the whole branch is reviewed as one diff.
Push and PR creation stay the owner's decision.

## Observed evidence

Not yet recorded.

## Delivery evidence

Not yet recorded.

## RDD and review evidence

Not yet recorded.

## Rollback boundary

Revert the commits of this branch; no migration, no deployed contract and no remote state is involved. The
`/distribution` URL parameter is additive (a page without it behaves exactly as before) and the new GET is
read-only.
