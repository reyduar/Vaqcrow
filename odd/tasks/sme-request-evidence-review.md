# ODD: SME request and evidence review (#56)

- Branch: `Vaqcrow#56_Task_Implement_SME_request_and_evidence_review` (off `Vaqcrow#18_Feat_...`)
- Issue: #56 (Task under Feature #18). Unblocks #57 (tests) and #58 (evidence doc).
- TDD: strict, source = project config, runner = `pnpm --filter @vaqcrow/web exec vitest run` (contracts: `pnpm --filter @vaqcrow/contracts test`)
- Delivery strategy: `ask-on-risk`. Forecast: ~450-600 authored lines (may need a chained split).

## Objective
Capture the synthetic SME request, sales history and evidence; let reviewers inspect missing or contradictory inputs; every simulated datum stays visibly labeled; missing data is never auto-completed; evidence references resolve; the request uses normalized contracts.

## Constraints
- `apps/web` consumes `packages/contracts` only (never `packages/domain`); presentation imports contracts type-only; `application/` has no React.
- Axios only behind the HTTP adapter/port; SWR for server state; React Hook Form for browser form state; backend stays authoritative.
- Gate before touching manifest/lockfile: search skills + inspect MCP for axios/swr/react-hook-form, record used skill/MCP or `none`.
- No secrets, PII, seeds or unsupported production claims. Existing tests (`prohibited-terms`, `trust-disclosures.integration`, `layout.traversal`) must not regress.

## Exploration findings (mapper, read-only)
- Routes: `app/(demo)/request/page.tsx` already renders SME name/KYC via `SyntheticValue` and `SalesEvidenceTable`.
- Fixture `application/fixtures/panaderia-horizonte.ts`: 8 periods; April missing, June anomalous; no contradictory case.
- `packages/contracts` has no SME request / sales / evidence schemas (zod `strictObject` pattern in `applicationReview*`).
- No evidence-ref resolver exists; `evidenceRef` is a bare string.
- axios, swr, react-hook-form, zustand, zod are NOT installed in `apps/web`.
- `HttpClientPort` + fetch adapter exist in `application/ports` and `infrastructure/http`.

## Delivery
- Strategy: `ask-on-risk`; chain strategy: `stacked-to-main` (user-chosen, cached; do not mix).
- Slice 1 (branch `Vaqcrow#56_Task_Implement_SME_request_and_evidence_review`): T1+T2, commits `6915c1d`, `69b9976`, 451 authored lines, reviewed (approved). Slightly over budget but cohesive (contracts + pure logic + tests); no cleaner split.
- Slice 2 (`...-02-http-adapter-and-deps`): T3. Slice 3 (`...-03-review-ui`): T4. Slice 4 (`...-04-page-wiring`): T5+T6. Each child branches off the previous one; each PR states start/end/dependencies/out-of-scope and carries the dependency diagram with the current PR marked.

## Open decisions
- [x] D1: contradictory input = declared request total that does not match the sum of reported sales periods (user-approved). Add a contradictory case to the synthetic fixtures.
- [x] D2: dependency gate = skill: none; MCP: context7 (the registry has no axios/swr/react-hook-form skill). Installed only axios ^1.20.0, swr ^2.5.1, react-hook-form ^7.88.0.

## Tasks
| ID | Task | Route | Status | Commit |
|----|------|-------|--------|--------|
| T1 | Contracts: SME request, sales period, evidence ref, review-finding schemas (+ index exports, RED first) | delegated writer (contracts + tests) | [x] | `6915c1d` |
| T2 | Pure `application/evidence`: `resolveEvidenceRef` + finding derivation (missing / anomalous / contradictory), never completes missing data | inline/delegated | [x] | `69b9976` |
| T3 | Dependency gate + install axios/swr/react-hook-form; Axios adapter behind `HttpClientPort` | delegated writer | [x] | `8093668` |
| T4 | Presentation: request form (RHF) + evidence review panel, all data labeled SIMULADO | delegated writer | [x] | `d04a9a9`, `f08b0fc` |
| T5 | Wire `request` page via SWR fetcher + adapter; regression run of existing tests | delegated writer | [x] | `a489f1c`, `751a89b`, `d82c30c` |
| T6 | `pnpm run verify` green; implementation evidence notes | inline | [x] | verify green on tip |

## Progress
- T1, T2 done (writer, strict TDD; RED/GREEN observed; parent spot check: web application tests 49 passed). Contracts 57 tests, web 150 tests, lint 0 errors, boundaries clean.
- RDD on. Assessed T1+T2 slice (451 lines, medium, deferred to slice close): consent granted, review approved, authority burned. Reviewed boundary is now `69b9976`.
- Advisory (non-blocking) review findings, follow-up candidates: (a) `reported` period with null amount is silently summed as 0 with no finding (evidence-review.ts:52-56, WARNING); (b) `salesPeriodSchema` accepts `missing` with a numeric amount (sme-evidence.ts:19-26); (c) Panaderia fixture test coupled to external fixture data (evidence-review.test.ts:112-119).
- Accepted defaults from writer gaps (follow D1 literally): contradictory fires independently of missing periods; only `reported` periods are summed; exact equality (integer ARS). Open, low priority: filter periods by request periodStart/periodEnd.
- Env note: default node is v26; run pnpm with node@24 (`PATH=/opt/homebrew/opt/node@24/bin:$PATH`).

- T3 done (`8093668`, ~150 authored lines + lockfile; 342 changed lines, medium): strict TDD RED/GREEN, web 158 tests, lint/boundaries/build green; parent spot check: http tests 10 passed. Slice 2 review approved and acknowledged; reviewed boundary is now `8093668`.
- Advisory findings from slice 2 (non-blocking): no request timeout on the axios instance (WARNING, wire from config in T5); non-2xx drops the backend error body, which limits form error handling in T4/T5; tests use fake axios instances only. `HttpClientError` lives in infrastructure (a port-level error type would be needed if application must catch it). `FetchHttpClient` is a stub that always throws.

- T4 done (`d04a9a9` form, `f08b0fc` panel; 496 authored lines, medium): skills `heroui-react` + `frontend-design`, HeroUI MCP for Button/Input; strict TDD RED/GREEN (form 7, panel 8 tests); web 173 tests, lint/boundaries/build green; parent spot check: 15 component tests passed. Slice 3 review approved and acknowledged; reviewed boundary is now `f08b0fc`.
- View-model types for T5 live in `apps/web/src/application/evidence/review-view-model.ts` (`SmeRequestFormValues` as raw strings, `SmeRequestSubmitError`, `EvidenceReviewItem`, `ReviewEvidence`). `ReviewFinding` has no totals: T5 must compute declared total and reported sum and pass them as pre-formatted strings.
- Advisory findings from slice 3 (non-blocking): (a) server `fieldErrors`/`submitError` are never cleared on edit and local RHF errors take precedence (sme-request-form.tsx:33-40); (b) a contradictory item with undefined totals renders an empty value next to a SIMULADO badge (evidence-review-panel.tsx:63-80), should fall back to "Dato faltante"; (c) static input ids would duplicate with two form instances, and the amount-format branch is untested.
- Open for T5: convert `declaredTotalArs` string to number before building the contract; confirm integer-ARS-only input; surface sanitized backend field errors (adapter currently drops non-2xx bodies); confirm that missing/anomalous items need no per-item SIMULADO badge (they show no amount, only period label and evidence ref); add request timeout from config.

- T5 done (`a489f1c`, `751a89b`, `d82c30c`; +1269/-32, ~547 non-test + ~720 test lines; medium, 1300 changed lines total): strict TDD (state hook RED confirmed after the fact by temporarily moving the implementation; disclosed), web 232 tests, lint/boundaries/build green; parent spot check: full web suite 232 passed. Two existing tests (`request/page.test.tsx`, `trust-disclosures.integration.test.tsx`) were re-scoped to the table because the new panel repeats period labels and SIMULADO badges; intent unchanged (diff read).
- T6: `pnpm run verify` observed green on the tip (build 4/4, boundaries 173 modules clean, root tests 23 passed).
- Slicing pass (chained-pr, one pass): T5 exceeded the budget by far, so its three cohesive commits become three stacked slices: `...-04-http-field-errors` (a489f1c, ~155 lines), `...-05-gateway-and-mapper` (751a89b, ~520), `...-06-page-wiring` (d82c30c, ~590). Branches created locally at those commits; each slice must be verified and reviewed independently before its PR. Per-slice standalone test/typecheck of 04 and 05 not yet run.
- Assumed backend envelopes (placeholders, no endpoint exists in apps/api): `POST /sme-requests`, `GET /sme-requests/current` -> `{ request, salesPeriods }`, errors `{ errors: [{ field, code }] }`; whitelisted fields (`declaredTotalArs`, `periodStart`, `periodEnd`) and codes (`required`, `not_integer`, `out_of_range`, `invalid_format`, `before_start`) mapped to Spanish copy.
- Open product gaps from T5: (1) `smeReference` is a constant `DEMO_SME_REFERENCE = "sme:SYN-PH-0001"` in the container; (2) backend periods use the neutral provenance "Registro del servicio de solicitudes"; (3) missing periods show "Evidencia sin resolver"; (4) no `NEXT_PUBLIC_API_BASE_URL` means gateway null: page shows fixtures only and submit says the service is unavailable, never success; (5) new success copy "Solicitud registrada en el entorno de demostración (SIMULADO)" needs review; (6) null-amount `reported` periods still sum as 0 and periods are not filtered by request range.

- D3 (user-approved): with no `NEXT_PUBLIC_API_BASE_URL` the page shows synthetic fixtures only and submit reports the service as unavailable, never success. The backend endpoint is out of scope for #56.
- Standalone slice checks: slice 04 web 178 tests, slice 05 web 207 tests, tsc printed no errors on both.

- Slice 04 (`a489f1c`, 155 lines) review approved and acknowledged (2 suggestions: redundant `__proto__` filter, timeout test proves config only).
- Slice 05 (`751a89b`, 520 lines) review approved and acknowledged. Its WARNING was verified real and fixed by strict TDD in a follow-up commit `52b9ebc` (RED observed, GREEN): a backend `code` such as `constructor` resolved to an inherited `Object.prototype` member in `FIELD_MESSAGES[field][code]`; now guarded with `Object.hasOwn`. The fix commit sits after the reviewed candidate and was not itself re-reviewed. Slice 06 was rebased onto it (now `f91d677`).
- Correction of my own earlier claim: I reported slices 04/05 "tsc printed no errors" from `tail -1`, which only showed the command line. Rechecked with exit codes: 04, 05 (after fix) and 06 typecheck exit 0; 05 tests 208, 06 tests 233; lint exit 0; boundaries clean.
- Remaining advisory from slice 05: `buildEvidenceRegistry` skips `missing` periods, asserted only through the Panaderia fixture, not a direct unit input.

- Slice 06 (`f91d677`, 627 lines) review approved and acknowledged. Advisories checked: (a) `submit` in `state/use-sme-request.ts` has no try/finally around `submitSmeRequest`; verified low risk because `submitSmeRequest` already catches gateway errors and `buildSmeRequest` is pure, so left as-is (candidate hardening); (b) claim that `within` is not imported in `request/page.test.tsx` is false: imported on line 1 and 233 tests pass.
- All four review lineages (T1+T2, T3, T4, T5 slices 04/05/06) are approved and acknowledged; reviewed boundary is `f91d677` (slice 05 fix `52b9ebc` was not re-reviewed itself).

## Next step (superseded)
Review slice 06 (base `52b9ebc`); then open stacked PRs (push/PR are the user's decision). Older plan: review each of the three T5 slices in order (assess, preflight, consent per slice), then resolve product gap (4) with the user, then open the stacked PRs (push/PR are the user's decision). #57 (tests) and #58 (evidence doc) follow under Feature #18.

## Delivery outcome (2026-09-18)
- #154 to #159 merged by the user in reverse order and cascaded to `main`; #56 CLOSED. #160 (#57 tests) merged into the already-merged slice 6 branch, so `44754d1` never reached `main` (verified with `git merge-base --is-ancestor`). Repaired with #161 (cherry-pick `c45e789`, base `main`, 243 web / 58 contracts tests, typecheck 0).
- #58 evidence doc: PR #162 (base `main`, commit `dd35d22`); contains `c45e789`, so merge #161 first. Doc says checks ran on `44754d1` (pre-rebase, identical tree to `c45e789`).
- Pending: merge #161 then #162; close #57, #58 and Feature #18 manually if GitHub does not; roadmap sync in `docs/planning/demo-tasks-list.md`; optional follow-ups for the pinned gaps.
