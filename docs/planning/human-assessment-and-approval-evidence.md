# Evidence for issue #62: Implement human assessment and approval

> [!info] Scope of this document
> Closing evidence for the implement Task [#62](https://github.com/reyduar/Vaqcrow/issues/62) ("Task: Implement human assessment and approval"), child of Feature [#19](https://github.com/reyduar/Vaqcrow/issues/19). It maps each acceptance criterion to files, tests and commits, records design decisions, simulation boundaries, verification results and honest limits. It adds no production code. Format follows [[docs/planning/supabase-schema-and-persistence-evidence|the #43 evidence document]]; the ordered test Task is [#63](#^issue-63) and the evidence Task is [#64](#^issue-64) in [[docs/planning/demo-tasks-list|demo-tasks-list]].

> [!warning] Demo boundary
> Everything here is a **simulated, non-production demo**. The assessment is a frozen fixture, the actor is a free-text field (there is no authentication), and nothing in this work is KYC/KYB, a credit decision or a production approval. The AI is advisory only and never decides.

## 1. Context and objective

Issue #62 asks an operator to review AI evidence and record an explicit approval or rejection with reasons, limits, actor and timestamp, keeping the decision authoritative on the backend. It was delivered as a Feature Branch Chain of small work units on top of the existing `application_review` persistence (Feature #13):

| Unit | Commit | Content |
|---|---|---|
| T1 | `a2ee438` | Contracts and domain invariants for human decisions |
| T2 | `b879602` | `human_decision` audit table and atomic `record_human_decision` RPC |
| T3 | `9b63a8e` | Repository adapter calling the RPC |
| T4 | `0552b2f` | Use case and `POST /application-reviews/:applicationId/decisions` |
| T5 | `d4a8a2b` | Credential-gated integration tests and FK cascade migration |
| T6 | `c2c3d6e`, `268d35a`, `2e57ec1` | Web application logic and gateway, screens, fix for a fresh attempt after an idempotency conflict |
| T7 | `6880eb9` | Grant-level audit immutability fix (plus remote migration application, no commit of its own) |

## 2. How to read this evidence

- Test counts and results in section 5 were observed in this working tree or recorded in [[odd/tasks/human-assessment-and-approval|the feature task document]]; nothing is inferred.
- Commands need Node 24: `PATH="/opt/homebrew/opt/node@24/bin:$PATH"`.
- The live, credential-gated integration suite was run by the operator after the merge and passed (section 6).

## 3. What was implemented

- **Contract.** `packages/contracts/src/application-review.ts` defines `humanDecisionCommandSchema` (strict object: `decisionId`, `applicationId`, `outcome` in `approved | changes_requested | rejected`, `actor` trimmed 1..120, `reason` trimmed 1..1000, `approvedLimitArs` nullable positive integer) and `humanDecisionRecordSchema` (adds server `decidedAt` and `correlationId`). Tests: `application-review.test.ts`, `human-decision-id.test.ts`.
- **Domain.** `packages/domain/src/application-review.ts` allows `human_review` to reach exactly the three outcomes (`decideApplicationReview`). Test: `application-review.test.ts`.
- **Database.** `supabase/migrations/20260919181453_create_human_decision_audit.sql` creates `public.human_decision` and `public.record_human_decision(...)`. Follow-ups: `20260919185430_cascade_human_decision_on_application_delete.sql` and `20260919203900_enforce_human_decision_grant_immutability.sql`.
- **API.** `apps/api/src/application/use-cases/record-human-decision.ts`, the repository port/adapter (`application-review-repository-port.ts`, `supabase-application-review-repository.ts`) and `apps/api/src/infrastructure/http/routes/human-decision.route.ts`. The route accepts exactly five body keys, parses with the contract, takes the correlation id from `request.id`, and maps outcomes to `201` applied, `200` replay, `404 not_found`, `409 state_conflict` (with `actualState`), `409 idempotency_conflict`, `503 unavailable`.
- **Web.** Assessment screen (`apps/web/src/app/(demo)/ai-assessment/page.tsx`) and approval screen (`.../approval/page.tsx`); decision logic in `apps/web/src/application/decision/` (`decision-form.ts`, `decision-attempt.ts`, `record-human-decision.ts`, `human-decision-errors.ts`); port `human-decision-gateway.ts` with HTTP adapter `infrastructure/decision/http-human-decision-gateway.ts`; state hook `state/use-human-decision.ts`; components `human-decision-form`, `human-decision-workspace`, `human-decision-record`, `ai-assessment-panel`, `evidence-review-panel`.

## 4. Acceptance-criteria mapping

Criteria quoted verbatim from `gh issue view 62`.

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | "The behavior described by Feature #19 is implemented within its documented boundary." | Met within the demo boundary | Sections 3 and 7; boundaries check clean in `pnpm run verify` (section 5); web never imports `packages/domain` |
| 2 | "Allow an operator to review AI evidence and record an explicit approval or rejection with reasons, limits, actor, and timestamp; the AI never makes the final decision." | Met | Evidence and assessment panels (`evidence-review-panel.tsx`, `ai-assessment-panel.tsx`, tests alongside); decision form requires explicit outcome, actor, reason and, for approval, a limit (`decision-form.ts`); server-side `decided_at` default in `human_decision`; the assessment fixture is advisory and has no path to the command (`simulated-assessment.ts`); `changes_requested` is also supported beyond the approve/reject wording |
| 3 | "Failure paths do not claim success or weaken human-control, simulation, or secret-handling boundaries." | Met | `human-decision-errors.ts` maps each API failure to an explicit non-success message (tests alongside); route returns 4xx/5xx for invalid, missing, conflicting or unavailable cases (`human-decision.route.test.ts`); adapter sanitizes database errors; no secrets, PII or seeds were added |

Commits: `a2ee438`, `b879602`, `9b63a8e`, `0552b2f`, `d4a8a2b`, `c2c3d6e`, `268d35a`, `2e57ec1`, `6880eb9`.

## 5. Design decisions

1. **Approved limit invariant.** `approved` requires a positive safe-integer `approvedLimitArs`; `changes_requested` and `rejected` require exactly `null`. Enforced in the contract (`superRefine`, `z.int().positive()`), and again in SQL by `human_decision_approved_limit_check`, so a direct writer cannot bypass it.
2. **Idempotency by `decisionId`.** The same id with the same business payload (`applicationId`, `outcome`, `actor`, `reason`, `approvedLimitArs`) is a **replay**: the original record is returned (`200`, `applied: false`) with no second row. The same id with a different payload is an **`idempotency_conflict`** (`409`), with no mutation. A new id against an already-terminal application is a `state_conflict`. A `pg_advisory_xact_lock` on the id serializes concurrent requests, so no unique-violation race leaks out.
3. **One atomic RPC.** `record_human_decision` performs idempotency check, the conditional `human_review` to outcome state transition (`UPDATE ... WHERE state = 'human_review'`) and the audit insert in one transaction. Either both the state change and the audit row exist or neither does.
4. **`SECURITY INVOKER`, `search_path = ''`.** The function never escalates privileges; execute is revoked from `public, anon, authenticated` and granted to `service_role` only.
5. **Service-role-only access.** RLS is enabled on `human_decision`, anon/authenticated have no grants, and the API is the only writer.
6. **Grant-level immutability fix (`6880eb9`).** Supabase grants broad privileges to `service_role` on new tables by default, so revoking from anon/authenticated alone left the audit mutable through the service role. The migration `20260919203900_...` revokes all from `service_role` and re-grants only `select, insert`. Parent cleanup still works because `ON DELETE CASCADE` (migration `20260919185430_...`) runs as the table owner. The integration test "keeps the audit immutable even for the service role" covers it.
7. **Fresh attempt after an idempotency conflict (`2e57ec1`).** The web client keeps one `decisionId` per attempt so retries replay safely, but after an `idempotency_conflict` it starts a new attempt instead of reusing the stale id (RED then GREEN observed).

## 6. Verification results

| Check | Observed result | Source |
|---|---|---|
| `pnpm run verify` | Passed on `268d35a` (lint, typecheck, test, build, boundaries, test:boundaries); boundaries clean | Feature document, T7 |
| `pnpm --filter @vaqcrow/web test` | 59 files, 317 tests passed (also after the `2e57ec1` fix) | Re-run in this working tree |
| `pnpm --filter @vaqcrow/api test` | 5 files, 61 tests passed | Re-run in this working tree |
| `pnpm --filter @vaqcrow/contracts test` | 5 files, 101 tests passed | Re-run in this working tree |
| `pnpm --filter @vaqcrow/domain test` | 1 file, 60 tests passed | Re-run in this working tree |
| Native review (RDD), all assessed medium risk | Approved and acknowledged for `f044f2c..d4a8a2b`, `d4a8a2b..268d35a` and the accumulated branch `f044f2c..HEAD` | Feature document, T5/T6, and orchestrator report |
| Commit `2e57ec1` | Medium, 26 lines, under budget, no review due | Feature document, T6 |
| Commit `6880eb9` | Under budget, no review due | Feature document, T7 |
| Live integration suite (`pnpm --filter @vaqcrow/api test:integration`) | 2 files, 15 tests passed against the hosted Supabase project on 2026-09-19: `human-decision-persistence` 8 tests and `application-review-persistence` 7 tests. Run by the operator with real credentials after the chain was merged; output supplied as pasted test results, not re-run by the assistant | Operator report |
| Remote migrations | The three human-decision migrations were applied to the **hosted** Supabase project through MCP (no local Docker). A rolled-back SQL probe showed: the RPC applies, `service_role` update and delete are denied, and deleting an `application_review` cascades to its audit rows | Feature document, T7 |

Integration suite: `apps/api/tests/integration/human-decision-persistence.integration.test.ts` contains 8 `it(...)` blocks (apply and exact audit record, replay, changed payload conflict, terminal state conflict, not found, publishable-key denial with `42501`, service-role immutability, concurrent ids).

## 7. Simulation boundaries

- **AI is advisory only.** The assessment screen renders a frozen fixture (`apps/web/src/application/assessment/simulated-assessment.ts`), labelled as simulated. It never approves, computes an obligation or moves funds. Feature [#20](https://github.com/reyduar/Vaqcrow/issues/20) owns the real LLM integration.
- **No authentication.** The actor is an editable text field defaulting to a demo actor (`DEMO_ACTOR`). The recorded actor is therefore self-declared, not an authenticated identity. Authentication is tracked in [#134](https://github.com/reyduar/Vaqcrow/issues/134).
- **Placeholder application id.** The workspace defaults to `DEMO_APPLICATION_ID` (`apps/web/src/application/fixtures/demo-application.ts`) until Feature #18 supplies a real application flow.
- **Web/domain separation.** The web consumes `packages/contracts` only; the decision itself is validated and applied by the API and database.

## 8. Limits and accepted risks

> [!info] Live verification
> After the merge, the operator ran the credential-gated integration suite (`pnpm --filter @vaqcrow/api test:integration`) against the hosted Supabase project: 15 of 15 tests passed, including replay, changed-payload conflict, terminal state conflict, `not_found`, publishable-key denial with `42501`, service-role immutability and concurrent decision ids. The `stderr` lines in that output (`23514`, `23505`) come from the negative tests forcing a CHECK and a duplicate key; the adapter logs them internally and does not return them to callers. Before this run, the only live evidence was the rolled-back SQL probe in section 6.

- **UI copy is Spanish**, matching the existing web copy and `docs/design/demo-ui.md`; code, tests and this document are English.
- **Remote migration history** lists `create_application_review` twice. This predates #62 and was not altered here.
- **No RLS policies.** Access control relies on grants (see #43 evidence and #134).
- **Non-blocking review advisories**, left for later work; notes for the last five give only the finding id and location reported by the reviewer (one earlier advisory, R3-idem-conflict-retry, was fixed in `2e57ec1`):

| Advisory | Note |
|---|---|
| R3-zod-parse-throw-state-conflict | Adapter parse of a `state_conflict` row can throw instead of mapping to a sanitized error |
| R3-route-no-repo-404 | Route wiring has no explicit 404 when no repository is configured |
| R3-sql-invariant-not-tested | The SQL approved-limit CHECK has no direct test |
| R3-startup-eager-supabase | Warning on eager Supabase client creation at startup (`apps/api/src/index.ts:5-6`) |
| R3-domain-decide-unused | Suggestion that `decideApplicationReview` (`packages/domain/src/application-review.ts:65-70`) is not used elsewhere |
| R3-mapper-throw-swallowed | Suggestion about a mapper throw being swallowed (`supabase-application-review-repository.ts:134-166`) |
| R3-applicationid-attempt-key | Suggestion about the attempt key (`apps/web/src/application/decision/decision-attempt.ts:17-21`) |
| R3-attempt-stale-on-conflict | Suggestion about attempt state after conflicts (`apps/web/src/state/use-human-decision.ts:42-52`) |

## 9. Delivery state

- Branch chain based at `f044f2c`; this document is unit T8 on `Vaqcrow#62_Task_Implement_human_assessment_and_approval-08-evidence-doc`. Push, tracker PR and chained PRs are pending explicit user authorization.
- Unblocks the test Task [#63](#^issue-63) and then [#64](#^issue-64). `demo-tasks-list.md` is not modified here; roadmap sync belongs to a later commit.
