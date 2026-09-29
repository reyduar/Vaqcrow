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
- No new stub route: the distribution read does not exist in the stub, and a slice that cannot be driven
  stays asserted at the component level. One scope refinement was allowed and is recorded below — the
  stub's `GET /campaigns/:campaignId` wire gained the `explorerUrl` the real API emits, because a double
  less faithful than the API it stands in for cannot prove the link the Feature requires.
- No Testnet, Horizon or LLM dependency anywhere in these suites; no secrets, seeds or PII.

## Acceptance criteria (verbatim from issue #93)

- Deterministic tests demonstrate the core behavior of Feature #29.
- Validation, rejection, and fallback behavior is covered where applicable.
- The focused suite passes without live external services or sensitive data.

## Stable checklist

- [x] T93-01 — Web: the no-backend fallback and the `/evidence` page's id wiring, asserted. Commit `4c82844`.
- [x] T93-02 — API: the read round-trip, with the response re-parsed through the shared contract.
      Commit `be24fd1`.
- [x] T93-03 — e2e: `/evidence` renders truthfully against the local stub, with and without a campaign id.
      Commits `1c3fd2e` and `3e4395f` (the second closes the explorer-link slice the first reported as
      undrivable).
- [x] T93-04 — `pnpm run verify` exit 0, readback, Engram mirror, work-unit commits recorded.

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

Every result below was observed in this working tree, on this branch, on 2026-09-29. None of it depends on
Testnet, Horizon, an LLM provider or any live external service.

- T93-01/T93-02 — focused runs: web `evidence-workspace.test.tsx` + the `/evidence` route suite **2 files /
  16 tests passed**; API `human-decision.route.test.ts` **1 file / 22 tests passed**; per-package suites
  `@vaqcrow/web` **105 files / 785 tests** and `@vaqcrow/api` **47 files / 961 tests**; both typechecks clean;
  `pnpm run boundaries` **no violations**.
- **All eleven new tests passed on their first run.** No genuine red was recorded, because none was real:
  the fallback branch, the page wiring and the wire envelope all behaved as the code claimed. They are
  guards over previously unproved surfaces, recorded as guards and not as reds that were fixed (`D2`).
- T93-03 — `pnpm --filter @vaqcrow/web run test:e2e` (whole local-only suite, chromium, stub API on
  loopback): **19 passed in 29.8s** — `campaign-vault` 9, `evidence-dashboard` 2, `guided-journey` 4,
  `human-decision` 4. No Testnet, no credentials; the external-request guard stayed satisfied.
- Closure gate — `pnpm run verify` **exit 0**: lint 5/5, typecheck 8/8, `lint:tests`/`typecheck:tests`,
  test 8/8, build 5/5, boundaries clean, `test:boundaries` 9 files / 93 tests. Per package: contracts
  13/487, domain 2/120, ai 5/107, api 47/961, web 105/785.
- One transient failure preceded that gate and is recorded rather than hidden: the first `verify` run failed
  with **three 5000 ms timeouts** — `layout.traversal.test.tsx > forward traversal through all six steps`,
  `distribution-workspace.test.tsx > prepares with the connected account as source…` and
  `human-decision-workspace.test.tsx > records a decision through the gateway…`, i.e. the **first test of
  each file**, on a host at **load average 16.09**. Re-run in isolation: **20 tests passed in 5.68 s**, those
  same first tests at 317–525 ms. Re-run as the full gate: exit 0, no timeouts. This is the load-induced
  transform-cost flake this repo already documented (`trust-disclosures-and-contract-custody-evidence.md`,
  `ai-failure-routing-evidence.md`); no assertion failed and no `testTimeout` was changed.

## Delivery evidence

- Work units, in order: `4c82844` `test(web): assert the evidence fallback and the route wiring`; `be24fd1`
  `test(api): pin the decision read envelope field by field`; `1c3fd2e`
  `test(e2e): prove the evidence step renders truthfully`; `3e4395f`
  `test(e2e): prove the vault explorer link end to end`; `baefb51`
  `docs(odd): start Task #93 test iteration log`; plus this closing log commit.
- Delivery strategy: one PR from `Vaqcrow#93_Task_Test_evidence_dashboard`, under the ~400-line budget (the
  range assessed `591 changed lines` including this log; no `size:exception` was requested for the code).
  Push and PR creation remain the owner's decision; the branch is based on the `#92` tip, so its PR is a
  stacked one over `Vaqcrow#92_Task_Implement_evidence_dashboard` until `#92`/PR #349 merges.
- Engram mirror: this document, under `odd/test-evidence-dashboard/tasks`.

## Decision recorded during the work

Two judgements the work surfaced, recorded rather than left implicit:

1. **The stub's fidelity was fixed, not the test.** `1c3fd2e` reported `partial`: the stub's campaign wire
   never emitted `explorerUrl`, so the positive explorer-link assertion was undrivable and the spec asserted
   the truthful negative instead. That gap is a defect in the double, not a boundary of the Task — the real
   API attaches the link to every reconciled snapshot it reads back — so the stub gained the same derivation
   (`campaignExplorerUrl`, one literal base) and `3e4395f` asserts the link's `href`, `target="_blank"` and
   `rel` for real. The stub stays the single source of the expected value: the spec derives it through the
   stub's own export rather than duplicating the string.
2. **The explicit no-leak assertion was kept.** The writer flagged one new API case as overlapping the
   pre-existing "maps unavailable to a sanitized 503" (whose `toEqual` already excludes extra keys) and
   offered to drop it. It stays: it *names* the security property (`message`/`details`/`hint` must never
   cross the wire) instead of implying it, which is exactly the house convention in this adapter's own
   error-mapping tests, and it drives the typed double path. Recorded so the overlap is a decision, not an
   accident.

## RDD and review evidence

RDD is enabled globally. The range from the branch point was assessed `medium` risk, **591 changed lines**,
`review_due: true`, reason `slice_budget_reached`, and the owner granted the candidate review.

**The native review could not be completed: the host reviewer produced no output.** Transaction
`review-5ac47109cd19705d` (lineage, one lens `review-reliability`, subject `sha256:0f8c67cd…`, correction
budget 200) was created and is still **`reviewing`**, `applicability: current_target`, with the reviewer slot
still open and reoffered by its exact-lineage STATUS. Three consecutive invocations of the provider-issued
reviewer Task returned `opencode_task_output_empty` — an empty result from the host sub-agent, twice with the
materialized candidate and once more after the slot was confirmed reoffered. No capture was admitted, no
finding was produced, and there is therefore **no review receipt for this candidate**.

This is a client-runtime transport failure in the reviewing host, not a Gentle AI contract failure, so no
provider-defect report was filed and the retries were stopped after three attempts rather than looped. What
holds instead is the verification of record: the writers' foreground runs above, `pnpm run verify` exit 0,
and the local-only Playwright suite at 19 passed. The candidate is test-only; the review would have been an
independent check, not the thing that makes it correct.

The open transaction is left in place, unfilled and unburned, so the owner can decide: re-run the reviewer
while the slot is still bound, or release it with `gentle-ai review abandon` and continue under ordinary
repository policy. Neither choice changes what was verified.

## Rollback boundary

Revert the commits of this branch. Tests and one log only: no migration, no route, no deployed contract and
no production behaviour is involved, so the rollback cannot leave the demo in a different state than before.
