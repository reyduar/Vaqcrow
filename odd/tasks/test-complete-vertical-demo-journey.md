# Task #96 — Test complete vertical demo journey

## Objective

Prove the complete vertical demo journey with deterministic tests, as Task #96
under Feature #30. The gap is one **single end-to-end browser walk** from the SME
request through to the evidence, not the per-step specs that exist today.

## Context

Feature #30 connects the synthetic SME journey (request → AI assessment → human
approval → vault funding → async confirmation → monthly sales → deterministic
obligation → Testnet distribution → evidence). Its implementation lives on the
`#95` feature-branch chain and is complete at the time of writing; this Task is
the ordered test Task that follows it.

What exists today, verified:

- **Six demo steps** (`apps/web/src/application/navigation/demo-steps.ts`):
  `request`, `ai-assessment`, `approval`, `funding`, `distribution`, `evidence`.
- **Five specs** under `apps/web/e2e/`: `guided-journey`, `campaign-vault`,
  `distribution-step`, `evidence-dashboard`, `human-decision`. `guided-journey`
  covers the request → assessment → approval half, the step traversal by URL,
  reload survival and history behaviour. **None walks the whole journey**:
  funding, the monthly sales feed, the derived obligation, the distribution and
  the evidence are only covered in isolation.
- **Playwright is already deterministic** (`apps/web/playwright.config.ts`):
  Chromium, one worker, zero retries, and a `webServer` pair that boots
  `e2e/support/stub-api-server.mjs` plus `next dev` against it. Nothing reaches
  Testnet, Horizon, Supabase or an LLM provider.
- **Stub endpoints today** (`e2e/support/stub-api-server.mjs`): `GET /health`,
  `POST /__reset`, `POST /__seed-assessment`, `POST /sme-requests`, `/campaigns*`
  (with contribution mirroring), `/revenue-share-distributions*`. Decisions are
  partially served under `/application-reviews`.
- **Gap found while scoping**: **`/sales-periods` is absent from every stub.**
  The monthly sales feed is not doubled anywhere, so the distribution step has no
  obligation to derive in a browser test.

## Problem

Task #96's acceptance criteria ask for the core behavior of the Feature to be
demonstrated deterministically, with validation, rejection and fallback covered.
Today the journey is proven step by step and the seams between steps are proven
by unit tests and by `guided-journey`'s URL traversal — but nothing asserts that
the identifiers produced by one step are the ones the next step consumes, all the
way to the evidence. The monthly sales feed has no double at all, so the
deterministic obligation cannot be reached from the browser.

## Scope

In scope:

- `apps/web/e2e/support/stub-api-server.mjs` and the sibling
  `stub-campaign-routes.mjs` / `stub-distribution-routes.mjs` — add the missing
  route(s) and frozen fixtures needed for the walk, in the existing style.
- One new spec, `apps/web/e2e/full-journey.spec.ts`.
- `odd/tasks/test-complete-vertical-demo-journey.md` — this record.

Out of scope:

- No change to production code. If the walk exposes a real defect, stop and
  report it instead of fixing it here; the defect belongs to its own work unit.
- No new dependency, no `playwright.live.config.ts` change, no Testnet.
- No weakening of the determinism rules in `playwright.config.ts`.
- No snapshot or visual testing.

## Constraints

- PR-gated checks must not depend on Testnet, Horizon, Supabase or a live LLM
  provider (Task #96's own technical requirement).
- Deterministic fixtures and doubles at the narrowest effective level.
- No secrets, PII, or unsupported production claims.
- Specs import `test` from `./support/local-only` and targets from
  `./support/targets`, and reset stub state per test — follow the existing
  pattern exactly. `e2e/support/freighter-emulator.ts` is the wallet double; the
  funding and distribution steps need it.
- Artifacts in English. Conventional Commits, no AI attribution.

## Tasks

- [x] **B1** — Extend the stub so the whole walk is reachable: the
  `/sales-periods` feed (the missing piece), plus whatever `/application-reviews`
  decision and `/revenue-share-distributions` shapes the journey needs, with
  frozen fixtures in the current style. *Route: delegated writer.*
- [x] **B2** — `full-journey.spec.ts`: one walk that submits the request,
  assesses it, approves it, funds and contributes to the vault through the
  Freighter emulator, records the sales period, derives and signs the
  distribution as the SME, and lands on the evidence. Assert the observable state
  at every step, and specifically that each step consumes the identifiers the
  previous one produced. *Route: delegated writer.*
- [x] **B3** — Cover the boundaries Task #96 asks for: at least one rejection and
  one fallback reachable from the journey (candidates: a distribution before the
  goal is met, `source_not_sme`, `already_distributed`, an empty sales history).
  *Route: delegated writer.*
- [x] **B4** — Run the checks and record actual results in this file.
  *Route: delegated writer.*

## Acceptance criteria

Quoted verbatim from Task #96:

- [ ] Deterministic tests or bounded rehearsal checks demonstrate the core
  behavior of Feature #30.
- [ ] Validation, rejection, and fallback behavior is covered where applicable.
- [ ] The focused verification passes without exposing sensitive data.

## Checks

```
pnpm --filter @vaqcrow/web exec playwright test e2e/full-journey.spec.ts
pnpm --filter @vaqcrow/web exec playwright test
pnpm run verify
```

`playwright-report/` and `test-results/` are artifacts, not work: remove them
before committing (the convention this repository already follows).

## Decisions (2026-09-30, user)

- Proceed with Task #96 now; its declared blocker (#95) is bookkeeping, since the
  implementation it tests is already on the chain. The GitHub dependency closes
  when #95 lands.
- Branch: `Vaqcrow#96_Task_Test_complete_vertical_demo_journey`, cut from the
  `#95` slice 09, so the spec stays a reviewable slice of its own.

## Progress

- [x] Scoping reconnaissance (six steps, five specs, stub endpoints, the missing
      `/sales-periods`).
- [x] Implementation (B1–B3).
- [x] Verification (B4).

### 2026-09-30 — implementation

- **RED (observed first).** `full-journey.spec.ts` was written before the stub was
  touched and run against the current stub:
  `pnpm --filter @vaqcrow/web exec playwright test e2e/full-journey.spec.ts` →
  **2 failed, 1 passed**:
  - `walks the request, assessment, approval, funding, sales record, distribution
    and evidence in one pass` failed at `recordNextSalesPeriod` with
    `Expected: 201, Received: 404` (the `/businesses/:businessId/sales-periods`
    route did not exist). The walk had already reached step 6, so request,
    assessment, approval, vault opening and the investor contribution all worked
    against the existing stub.
  - `refuses a second distribution for the same campaign and period` failed at the
    same call for the same reason.
  - `refuses a distribution before the vault reached its goal` passed against the
    old stub (it does not need the feed): a characterization of the existing
    `campaign_not_settled` refusal.
- **B1 — stub extension** (`apps/web/e2e/support/stub-api-server.mjs`,
  `apps/web/e2e/support/stub-distribution-routes.mjs`). Added
  `GET`/`POST /businesses/:businessId/sales-periods`, resolving both the demo
  business id (`panaderia-horizonte`) and the synthetic SME reference
  (`sme:SYN-PH-0001`) to one frozen series, with the record-next idempotence
  (201 applied / 200 replay) and the exact-`{}` body rule of the real route.
  Added `NEXT_SALES_PERIOD` (2026-09, 3,860,000 ARS). `GET /sme-requests/:id`
  now serves the same recorded series. The distribution derivation takes the
  feed's latest reported period as an injected dependency and derives
  `period`/`salesArs`/`obligation` from it (default 2026-08, 2026-09 once
  recorded) instead of the frozen constant, and maps an empty feed to
  `no_eligible_period`. Added the `GET /application-reviews/:id/decisions` read
  returning the recorded decision, so the evidence step can project it.
- **B2 — the walk** (`apps/web/e2e/full-journey.spec.ts`). One pass asserting, at
  every step, that the step consumes what the previous one produced:
  1. request → `?application=<stub application id>`;
  2. AI assessment on that application → `asm_stub_001`, moved to human review;
  3. approval shows the same persisted assessment, records the decision;
  4. funding opens the vault → `&campaign=<opened campaign id>` (same application);
  5. a second wallet contributes; the vault settles;
  6. the feed records 2026-09 against the request's own `smeReference`;
  7. the distribution review shows the recorded period (2026-09, 3,860,000 ARS,
     4.50 %, 173,700 ARS, 0.6948 XLM) and the SME signs it →
     `&distribution=<distribution id>`;
  8. evidence reads decision + vault + distribution back by those ids and names
     the request (`Solicitud` = the request's application id), the vault contract
     and the distribution hash.
- **B3 — boundaries.** `refuses a distribution before the vault reached its goal`
  (rejection: `campaign_not_settled`, the app's own copy) and `refuses a second
  distribution for the same campaign and period, without duplicating it`
  (fallback: `already_distributed`, "No se registró otra."). Not covered, and
  why: `source_not_sme` is already exercised by `distribution-step.spec.ts`; the
  empty-sales-history case (`no_eligible_period`) is unreachable from the UI —
  the web always sends the demo reference (`odd/tasks/complete-vertical-demo-journey.md`,
  T3b notes) — so the stub branch is defensive, not browser-reachable.
- **Commits** on `Vaqcrow#96_Task_Test_complete_vertical_demo_journey`:
  - `5fa4fd3` `test(web): double the monthly sales feed and the decision read in the e2e stub`
  - `7a37b1c` `test(web): walk the complete vertical demo journey end to end`

## Verification evidence

All commands run in the foreground in this working tree, 2026-09-30.

| Command | Observed result |
|---|---|
| `pnpm --filter @vaqcrow/web exec playwright test e2e/full-journey.spec.ts` (before the stub change) | **2 failed, 1 passed** — the walk and the `already_distributed` case both fail at `recordNextSalesPeriod` (`Expected: 201, Received: 404`), the missing route. See the RED note above. |
| `pnpm --filter @vaqcrow/web exec playwright test e2e/full-journey.spec.ts` (after the stub change) | **3 passed (18.3s)** |
| `pnpm --filter @vaqcrow/web exec playwright test` | **31 passed (52.7s)** — all six specs, including `distribution-step` and `evidence-dashboard`, unchanged against the extended stub |
| `pnpm run verify` (first run) | **passed**, all stages: lint `0 errors` (1 pre-existing warning in `apps/web/src/infrastructure/http/fetch-http-client.ts`), typecheck, test (domain 120, contracts 526, ai 107, web 927, api 1147), build, boundaries (`no dependency violations found`), `test:boundaries` **143 passed** |

**Known flake, reported rather than papered over.** Later `pnpm run verify` runs
passed every stage except `test:boundaries`, whose three dependency-cruiser /
TypeScript-compilation tests time out at the default 5000 ms
(`tests/boundaries.test.ts`: "compiles the contracts runtime barrel for a
DOM-only consumer", "resolves both SDKs in the real app sources…", "the real
`boundaries` script glob … never reaches the fixtures"). This is environmental,
not a regression: it reproduces identically with the two stub edits stashed
(clean tree), the machine's load average was ~26 during the failing runs, and the
same suite passed 143/143 in the green `verify` run above. `tests/boundaries.test.ts`
is outside every file this task changed (`apps/web/e2e/**`, `odd/**`).

## Acceptance criteria

- [x] Deterministic tests demonstrate the core behavior of Feature #30: the one
  `full-journey.spec.ts` walk proves every seam from the request to the evidence.
- [x] Validation, rejection, and fallback behavior is covered where applicable
  (`campaign_not_settled`, `already_distributed`); the remaining candidates are
  either already covered in their own spec or unreachable from the UI (see B3).
- [x] The focused verification passes without exposing sensitive data: every
  value is a frozen synthetic literal and `./support/local-only` fails the suite
  if the browser reaches any host beyond the app and the stub.
