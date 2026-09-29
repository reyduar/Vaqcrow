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

- [x] T92-01 — Read surface: `readLatestHumanDecision` on the repository port, its Supabase implementation,
      and `GET /application-reviews/:applicationId/decisions`; deterministic tests. Commit `655d38f`.
- [x] T92-02 — Web: human-decision gateway read + `application/evidence/build-evidence-timeline.ts` (pure
      projection, no I/O) with its unit tests. Commit `7916422`.
- [x] T92-03 — Web: `/distribution` carries `?distribution=` in the URL, so the hash survives navigation.
      Commit `d0dfa6e`.
- [x] T92-04 — Web: `/evidence` page + `EvidenceWorkspace` rendering the timeline through `EvidenceTimeline`
      (`Badge`, `HashDisplay`, `DistributionCalculation`); component tests for complete, pending, failed,
      absent and unavailable evidence. Commit `172e6b3`.
- [x] T92-05 — e2e impact check: the guided journey, campaign-vault and human-decision suites pass locally.
- [x] T92-06 — `pnpm run verify` exit 0, readback, Engram mirror, work-unit commits recorded.

Two follow-up commits carry corrections that the work itself surfaced: `07b0905` (deterministic tiebreaker in
the new read) and `b10ed2b` (the recap no longer labels a live hash as a prior-run hash). The approved final
review raised two more advisories, resolved as separate later work: `c8e6e6a` (only the API's own `not_found`
counts as an absent decision) and `24982d8` (the distribution page's URL write is now asserted).

## Route declaration

- T92-01 — delegated direct: one bounded writer (API read surface).
- T92-02 — delegated direct: one bounded writer (web gateway read + pure projection).
- T92-03 + T92-04 — delegated direct: one bounded writer, two work-unit commits (both are the same layer's
  presentation work).
- `07b0905` and `b10ed2b` — parent, inline: already-understood mechanical edits (one line + its assertion)
  that the review and the readback surfaced, so no writer was needed.
- T92-05/T92-06 — parent: ran the closure gate and the spot check, read the artifacts back, recorded the
  decisions, the commit identities and the mirror.

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

Every result below was observed in this working tree, on this branch, on 2026-09-29. None of it depends on
Testnet, Horizon or an LLM provider.

- `GET /application-reviews/:applicationId/decisions` — focused route + adapter run: **2 files / 63 tests
  passed**; `pnpm --filter @vaqcrow/api test` **47 files / 955 tests passed**; API typecheck clean;
  `pnpm run boundaries` **498 modules / 1562 dependencies, no violations** (commit `655d38f`).
- The deterministic tiebreaker (`07b0905`) — the adapter suite alone: **47 tests passed**.
- Web projection (`7916422`) — focused run of `src/application/evidence` + `src/infrastructure/decision`:
  **6 files / 79 tests passed**; `pnpm --filter @vaqcrow/web test` **104 files / 764 tests passed**; web
  typecheck clean; boundaries **502 modules / 1575 dependencies, no violations**. `formatStroopsAsXlm` was
  byte-identical in the two workspaces, so it moved to `apps/web/src/application/format/stroops.ts` and both
  components now import it — no third copy, and the two component suites stayed green.
- `/distribution` URL identity and the `/evidence` page (`d0dfa6e`, `172e6b3`) — focused run of the two route
  suites plus the two new component suites: **4 files / 18 tests passed**; `pnpm --filter @vaqcrow/web test`
  **105 files / 777 tests passed**; `pnpm run build` **5/5 tasks**, with `/evidence` and `/distribution`
  prerendering as static inside their `Suspense` boundaries; boundaries **506 modules / 1608 dependencies, no
  violations**. The writer also ran the local-only Playwright suites (`guided-journey`, `campaign-vault`,
  `human-decision`) against the stub API: **17 tests passed in 28.6s**, no credentials and no Testnet.
- Closure gate — `pnpm run verify` **exit 0**, all 8 turbo tasks successful (lint, typecheck, test, build,
  boundaries, test:boundaries). One transient failure preceded it and is recorded rather than hidden: the
  first `verify` run failed with `layout.traversal.test.tsx > forward traversal through all six steps`
  **timing out at 5000 ms** — the first test of that file, i.e. the load-induced transform-cost flake this
  repo already documented in `trust-disclosures-and-contract-custody-evidence.md` and
  `ai-failure-routing-evidence.md`. Re-run in isolation: **3 tests passed in 464 ms**. Re-run as the full
  gate: exit 0. No assertion failed at any point and no timeouts were configured away.
- Readback: `/evidence` no longer renders `StepPlaceholder` (`queryByText(/Step content coming soon/i)` is
  asserted absent, as `/funding` already did); the last placeholder route in the shell is gone, so
  `step-placeholder.tsx` and its unit test were deleted and the stale comment in `step-trust-disclosures.tsx`
  corrected. No `docs/**` file was touched.
- The two advisory fixes (`c8e6e6a`, `24982d8`) — focused run: **2 files / 19 tests passed**, web typecheck
  clean. Final closure gate `pnpm run verify` after them: **exit 0**, with `@vaqcrow/web` at **105 files /
  780 tests**, `@vaqcrow/api` **47 files / 955 tests**, `@vaqcrow/contracts` **13 files / 487 tests**,
  `@vaqcrow/domain` **2 files / 120 tests**, `@vaqcrow/ai` **5 files / 107 tests** and `test:boundaries`
  **9 files / 93 tests**.

## Delivery evidence

- Work units, in order: `655d38f` `feat(api): expose latest human decision read`; `07b0905`
  `fix(api): make latest-decision read deterministic on ties`; `7916422`
  `feat(web): read latest decision and project evidence timeline`; `d0dfa6e`
  `feat(web): carry the distribution id in the url`; `172e6b3`
  `feat(web): render the decision and transaction evidence timeline`; `b10ed2b`
  `fix(web): stop labelling a live hash as a prior-run hash`; `1d17cd2`
  `docs(odd): record Task #92 evidence dashboard delivery`; `c8e6e6a`
  `fix(web): treat only the api's not_found as an absent decision`; `24982d8`
  `test(web): prove the distribution page writes the id into the url`.
- Delivery strategy: `exception-ok`, one PR with a maintainer-approved `size:exception` (owner decision,
  2026-09-29). Push and PR creation have not been performed and remain the owner's decision.
- Engram mirror: this document, under `odd/implement-evidence-dashboard/tasks`.

## RDD and review evidence

RDD is enabled globally (`gentle-ai review mode status` → on, decided by global). Three candidate boundaries
were reached, and the owner decided each one:

1. **Reviewed and approved — lineage `review-00a604e9800bbec6`**, medium risk, 10 files / 470 lines, one lens
   (`review-reliability`). The owner granted consent; the reliability review returned **approved** with two
   advisory, non-blocking findings and no correction. The exact acknowledgement burned the authority
   (`action: "acknowledged"`, `authority: "burned"`). Its findings were handled as separate later work, as
   the capture instructed: the `WARNING` (newest-row selection had no tiebreaker, so equal `decided_at`
   values had no defined winner) became `07b0905`; the `SUGGESTION` (the new GET awaits the port outside a
   `try`/`catch`, so a throwing implementation would escape as Fastify's default 500) is **not** applied and
   is recorded here instead — the sibling read route `application-manual-review.route.ts` trusts the port's
   total `Result` union in exactly the same shape, and this adapter catches every failure into that union, so
   adding a guard only here would be inconsistent defensive code. If a future implementation of the port can
   reject, the guard should land in both read routes at once.
2. **Declined by the owner — candidate `sha256:2ba6b9ec…`**, medium risk, 13 files / 776 lines, the
   deterministic-tiebreaker fix plus the whole web projection. The consent envelope was relayed losslessly;
   the owner chose "Skip this time" and the exact decline invocation ran (`action: "declined"`,
   `consent: "declined_this_candidate"`). No review record exists for that candidate.
3. **Reviewed and approved — lineage `review-d1e22ef1e476c0e0`**, medium risk, 27 files / 1723 lines, one lens
   (`review-reliability`) — the whole range from the first reviewed boundary to the delivery log, i.e. the
   refused candidate's content plus everything after it. The owner granted consent; the review returned
   **approved** with two advisory, non-blocking findings and no correction, and the exact acknowledgement
   burned the authority (`action: "acknowledged"`, `authority: "burned"`). Both advisories were then resolved
   as the separate later work the capture instructs: `c8e6e6a` narrows the absent-decision classification from
   "any 404" to the API's own `not_found` code (a misrouted base URL answering 404 is a failure to read, not
   proof that no decision exists), and `24982d8` asserts the distribution page's own URL write, which the
   workspace-level test had left uncovered. Those two fixes are themselves unreviewed and are covered by the
   final `pnpm run verify` exit 0 plus the focused runs recorded above.

## Decision recorded during the work

`b10ed2b` removed `microcopy.priorRunHash` from the recap. The first implementation labelled the transaction
entry's hash with "Hash de ensayo previo; no corresponde a la ejecución actual" whenever the entry carried a
transaction badge. That is a false claim for the demo's normal path: the hash read back from the API comes
from the run that produced it, and the recap has no way to tell a live hash from a rehearsal hash. The step's
own note (`StepTrustDisclosures step="evidence"`) still carries the rehearsal-hash disclosure, where it
describes the concept instead of mislabelling a specific value.

## Rollback boundary

Revert the commits of this branch; no migration, no deployed contract and no remote state is involved. The
`/distribution` URL parameter is additive (a page without it behaves exactly as before) and the new GET is
read-only.
