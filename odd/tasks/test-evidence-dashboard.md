# Test evidence dashboard

Iteration log for issue #93 (Task under Feature #29), branch
`Vaqcrow#93_Task_Test_evidence_dashboard`, base `8b648ab` (the tip of the #92 branch, which is still open
as PR #349).

## Objective

Prove the evidence dashboard with deterministic tests: the successful path, the rejection/validation
boundaries and the fallbacks, at the narrowest effective level, without live external services.

## Problem

#92 shipped the dashboard with a substantial suite, so the remaining risk is not "no tests" but
**unproved surfaces**. A read-only mapping of the existing coverage confirmed three:

1. **The no-backend fallback never runs as an assertion.** `EvidenceWorkspace` builds its gateways from
   `process.env["NEXT_PUBLIC_API_BASE_URL"]` and every one of them is `null` when the variable is absent;
   the existing tests always inject gateways, so the branch that decides what a person sees without a
   configured backend is executed by the `/evidence` route test but never asserted.
2. **The `/evidence` page's own wiring is unproved.** The page reads `?campaign=` and `?distribution=` and
   hands them to the workspace, but its test mocks `useSearchParams` to a constant `null` and asserts only
   the disclosures — nothing observes the ids flowing down. `/distribution` had exactly this gap until
   `24982d8`, and the same shape of test closes it here.
3. **The read envelope is pinned from one side only.** The API route test asserts the literal
   `{ decision }` and the web gateway test parses a hand-written `{ decision: record }`; nothing proves the
   body the API actually serializes re-parses through the shared contract the web consumes, field by field.

There is also no journey-level proof that `/evidence` renders truthfully against the demo's stub backend —
`guided-journey.spec.ts` walks to the step and asserts the heading only.

## Why

Feature #29's testing strategy is explicit: *"Component and API tests for complete, pending and failed
evidence."* #92's Task stated that it "can be validated by the ordered test Task" — this is that Task, and
its acceptance criteria are the ones quoted below.

## Scope

In:

- `apps/web/src/presentation/components/evidence-workspace.test.tsx` — the unconfigured-backend fallback.
- `apps/web/src/app/(demo)/evidence/page.test.tsx` — the page's read of the two ids.
- `apps/api` — a deterministic read round-trip through the real POST/GET routes with a repository double.
- `apps/web/e2e` — the `/evidence` step asserted against the local stub, with and without a campaign id.
- This log and its Engram mirror.

Out:

- No production behaviour change unless a red test exposes a real defect; if that happens it is fixed
  minimally, recorded here, and covered by the same test that found it.
- No new stub route beyond what the existing e2e stub already answers (the campaign route exists; the
  distribution read does not, and a slice that cannot be driven stays asserted at the component level).
- No Testnet, Horizon or LLM dependency anywhere in these suites; no secrets, seeds or PII.

## Acceptance criteria (verbatim from issue #93)

- Deterministic tests demonstrate the core behavior of Feature #29.
- Validation, rejection, and fallback behavior is covered where applicable.
- The focused suite passes without live external services or sensitive data.

## Stable checklist

- [ ] T93-01 — Web: the no-backend fallback and the `/evidence` page's id wiring, asserted.
- [ ] T93-02 — API: the read round-trip, with the response re-parsed through the shared contract.
- [ ] T93-03 — e2e: `/evidence` renders truthfully against the local stub, with and without a campaign id.
- [ ] T93-04 — `pnpm run verify` at closure, readback, Engram mirror, work-unit commits recorded.

## Route declaration

- T93-01 + T93-02 — delegated direct: one bounded writer (unit + API tests).
- T93-03 — delegated direct: one bounded writer (Playwright).
- T93-04 — parent: closure gate, readback, decisions, commits and mirror.

## Design decisions

- **D1 — Coverage is added where it can fail, not where it repeats.** Every new test asserts something
  the current suite cannot: a branch nobody ran, a wiring nobody observed, or a wire shape pinned from one
  side only. Duplicating an existing assertion is out of scope.
- **D2 — A guard that passes on the first run is recorded as a guard.** For the fallback branch the
  implementation is already correct, so the honest record is "the scenario passed on first run and now
  guards the behaviour", never a fabricated red.
- **D3 — The narrowest effective level wins.** The complete/pending/failed matrix stays at the component and
  projection level that #92 already established; e2e is reserved for what only a browser proves — that the
  route, its container, the HTTP gateway and the projection agree end to end.
- **D4 — The e2e stays local-only.** No Testnet, no credentials: the stub answers on loopback and the
  external-request guard keeps it that way.

## Review workload forecast

Authored changed lines (additions + deletions), generated files excluded: **≈250–350** — all tests plus this
log. Under the ~400-line delivery budget, so the default `ask-on-risk` strategy does not need to stop: one PR
from `Vaqcrow#93_Task_Test_evidence_dashboard`.

## Observed evidence

Not yet recorded.

## Delivery evidence

Not yet recorded.

## RDD and review evidence

Not yet recorded.

## Rollback boundary

Revert the commits of this branch. Tests and one log only: no migration, no route, no deployed contract and
no production behaviour is involved, so the rollback cannot leave the demo in a different state than before.
