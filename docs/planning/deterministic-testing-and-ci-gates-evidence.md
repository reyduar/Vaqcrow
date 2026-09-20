# Evidence for Feature #15: Set up deterministic testing and CI gates

> [!info] Scope of this document
> Closing evidence for Feature [#15](https://github.com/reyduar/Vaqcrow/issues/15) ("Feature: Set up deterministic testing and CI gates"), delivered through its three Tasks: implement [#47](https://github.com/reyduar/Vaqcrow/issues/47), test [#48](https://github.com/reyduar/Vaqcrow/issues/48) and this document [#49](https://github.com/reyduar/Vaqcrow/issues/49). It maps each acceptance criterion to files, tests and commits, records design decisions, simulation boundaries, verification results and honest limits. It adds no production code. Format follows [[docs/planning/human-assessment-and-approval-evidence|the #62 evidence document]].

> [!warning] Demo boundary
> Everything here is a **simulated, non-production demo**. The CI jobs use a local test double, never a live service: no job reaches Stellar Testnet, Horizon, Supabase or an LLM provider, and none requires a repository secret. The stub API is a **test double for the future backend**, not a backend: it validates nothing beyond shape and is never deployed.

## 1. Context and objective

Feature #15 asks for Vitest, Testing Library and Playwright configured as deterministic gates for pull requests, using local doubles, with documented commands, a frozen install and no dependency on live external services. It was delivered as three Tasks:

| Task | Issue | Delivery |
|---|---|---|
| Implement | [#47](https://github.com/reyduar/Vaqcrow/issues/47) | PR [#176](https://github.com/reyduar/Vaqcrow/pull/176) — commits `d56f795`, `b9c4b23`, `d253e07`; merged to `main` at `e3ca3e8` |
| Test | [#48](https://github.com/reyduar/Vaqcrow/issues/48) | PR [#178](https://github.com/reyduar/Vaqcrow/pull/178) — commit `9054fbe`; **open at the time of writing** |
| Document evidence | [#49](https://github.com/reyduar/Vaqcrow/issues/49) | this document |

Vitest and Testing Library were already in place from earlier Features; #47 added the missing pieces (Playwright, the CI workflow, the local double) and #48 proved the gates themselves.

## 2. How to read this evidence

- Test counts and results in section 6 were **observed in a working tree or in CI**, and each row names its source. Nothing is inferred.
- Commands need Node 24: `PATH="/opt/homebrew/opt/node@24/bin:$PATH"`.
- This document was written on a branch based on `main` at `e3ca3e8`, where #47 is merged and #48 is not. Results that belong to #48 say so explicitly; they become reproducible on `main` once PR #178 merges.

## 3. What was implemented

- **Playwright configuration.** `apps/web/playwright.config.ts`: Chromium only, `workers: 1`, `fullyParallel: false`, `retries: 0`, `forbidOnly` bound to `process.env.CI`, `testDir: "./e2e"`, and a two-entry `webServer` array (the stub double, then `next dev`) whose readiness checks are both loopback.
- **Local API double.** `apps/web/e2e/support/stub-api-server.mjs` serves the demo's documented HTTP contracts from frozen literals (no `Date.now`, no `Math.random`, no `new Date`), with CORS and `POST /__reset` for per-test isolation. It listens on `127.0.0.1` only.
- **Browser suite.** `apps/web/e2e/guided-journey.spec.ts` (4 cases: entry redirect, chrome and progress, six-step traversal, SME request round trip against the double) and `apps/web/e2e/human-decision.spec.ts` (4 cases: no preselection plus advisory AI, local refusal, recorded decision, `applicationId` path).
- **External-request guard.** `apps/web/e2e/support/local-hosts.ts` holds the pure predicate (`LOCAL_HOSTS`, `isLocalRequest`) and `local-only.ts` consumes it in an auto fixture that fails any test whose browser requests a non-loopback host.
- **CI workflow.** `.github/workflows/ci.yml` runs on `pull_request` and pushes to `main`, with `permissions: contents: read` and two jobs, both installing with `pnpm install --frozen-lockfile`: `quality` runs `pnpm run verify`; `e2e` installs Chromium and runs `pnpm run test:e2e`.
- **Task wiring.** `turbo.json` declares `test:e2e` with `dependsOn: ["^build"]` and `cache: false`; the root and web `package.json` expose `test:e2e` and `test:e2e:install`. The `^build` dependency exists because the dev server resolves `@vaqcrow/contracts` from `dist/`.
- **Gate meta-tests (#48).** `tests/testing-and-ci-gates.test.ts` asserts on the gate artifacts themselves (workflow, Playwright config, stub, script/task wiring, documented commands, E2E boundary) and exercises the guard's rejection path directly.

## 4. Acceptance-criteria mapping

Feature #15 criteria, quoted verbatim from `gh issue view 15`.

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | "Commands are documented" | Met | `README.md` §Stack and §Desarrollo y calidad document `pnpm run test:e2e:install` and `pnpm run test:e2e`; asserted by the "documented commands" block of `tests/testing-and-ci-gates.test.ts` |
| 2 | "CI uses frozen install" | Met | Both jobs in `.github/workflows/ci.yml` run `pnpm install --frozen-lockfile`; asserted by the "installs with a frozen lockfile in every job that installs" case |
| 3 | "normal checks need no external services" | Met | The E2E suite talks to the stub double; the `externalRequestGuard` fixture fails any test that reaches a non-loopback host; no job references `secrets.` or an external URL |

Task #47's Playwright additions and Task #48's criteria, quoted verbatim from their issues.

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 4 | #47: "Deterministic Playwright browser tests cover the issue-critical paths using local fixtures or doubles" | Met | `guided-journey.spec.ts` and `human-decision.spec.ts` against `stub-api-server.mjs`; determinism controls in section 5 |
| 5 | #47: "Pull request verification completes without requiring live external services" | Met | CI runs `35479682438` (#47) and `35485729460` (#48) both `success`; the guard makes it enforceable |
| 6 | #47: "Implementation evidence records the applicable skill or MCP support used—or `none`—before any Playwright-related manifest or lockfile mutation" | Met | Section 5, item 6 |
| 7 | #48: "Deterministic coverage demonstrates the core behavior for Feature #15" | Met | 25 meta-tests in `tests/testing-and-ci-gates.test.ts` cover the workflow, config, stub, wiring and docs |
| 8 | #48: "Rejection or failure behavior is covered where the feature has a safety boundary" | Met | The guard's rejection path is exercised behaviorally, including hosts that merely contain a loopback string |
| 9 | #48: "The test suite is reproducible without live external services" | Met | No network access is needed; the double binds loopback |

## 5. Design decisions

1. **Determinism over convenience.** Chromium only, one worker, no retries, `forbidOnly` in CI. A flaky pass is a failure, never something a retry may hide. The stub's server-side literals (`DECIDED_AT`, `CORRELATION_ID`) are frozen so assertions never race a clock or an RNG.
2. **Two `webServer` entries, both loopback.** Playwright's `webServer` accepts an array, and its `env` merges with `process.env`, so `NEXT_PUBLIC_API_BASE_URL` set there reaches `next dev`. This is what lets the browser exercise the real axios client and the real contract validation while never leaving the machine.
3. **Turbo builds the dependencies first.** `test:e2e` depends on `^build` because `apps/web` resolves `@vaqcrow/contracts` from `dist/`. Verified by deleting `packages/*/dist` and re-running: the suite still passed.
4. **The double must satisfy strict contracts.** `salesPeriodSchema` and `humanDecisionRecordSchema` are strict objects, so the stub returns exactly the contract fields. Extra convenience fields such as `label` or `provenance` throw.
5. **The safety boundary is exercised, not asserted.** The guard predicate lives in a Playwright-free module so the root suite can import it (pnpm's strict `node_modules` make `apps/web`'s dependencies unresolvable from the root). Coverage includes `127.0.0.1.evil.com` and `localhost.evil.com` — the cases a `startsWith`/`includes` check would have accepted.
6. **Skill / MCP gate, recorded before the manifest changed.** No Playwright, browser-testing, Next.js or CI-workflow skill is installed, in the session's injected skills or in `.atl/skill-registry.md`: `skill_resolution: none`. Of the connected MCP servers, **`context7`** was used for authoritative Playwright documentation (`webServer` multi-server configuration, `reuseExistingServer`, `baseURL`, CI retry semantics) before `playwright.config.ts` was written. The `playwright` MCP server (`@playwright/mcp`) is **not** connected, and adding it is Phase 4 local-tooling work in `docs/architecture/deploy-planning.md` ("Sin issue — configuración local de entorno, no scope funcional de la demo"); discovery authorized no unrelated dependency or MCP configuration.
7. **The gates are themselves under test.** #48 asserts on the artifacts rather than on the app, because the app is already covered by the E2E suite. Source-text assertions run through a conservative `withoutComments` helper: the first run false-positived on the stub's own docstring, which mentions `Date.now()`. The assertion was not weakened — the comments are stripped.

## 6. Verification results

| Check | Observed result | Source |
|---|---|---|
| `pnpm install --frozen-lockfile` | Exit 0 ("Already up to date") | Re-run in this working tree |
| `pnpm run verify` | Exit 0: lint, typecheck, test, build, boundaries, test:boundaries | Re-run in this working tree |
| Boundaries | `no dependency violations found (216 modules, 481 dependencies cruised)` | Re-run in this working tree |
| `pnpm --filter @vaqcrow/domain test` | 1 file, 60 tests passed | Re-run in this working tree |
| `pnpm --filter @vaqcrow/contracts test` | 5 files, 101 tests passed | Re-run in this working tree |
| `pnpm --filter @vaqcrow/api test` | 5 files, 61 tests passed | Re-run in this working tree |
| `pnpm --filter @vaqcrow/web test` | 59 files, 317 tests passed | Re-run in this working tree |
| `pnpm run test:boundaries` (root suite) | 2 files, 23 tests passed **on this branch**; 3 files, 48 tests passed on the #48 branch, where `tests/testing-and-ci-gates.test.ts` adds 25 | Re-run in both working trees |
| `pnpm run test:e2e` | Exit 0, **8 passed** (~12s) | Re-run in this working tree |
| `vitest run tests/testing-and-ci-gates.test.ts` | **25 passed**, after a first RED run that failed to resolve `local-hosts.ts` | #48 branch working tree |
| CI run `35479682438` (#47 branch) | `success` — `quality` 1m31s, `e2e` 1m13s | GitHub Actions |
| CI run `35485729460` (#48 branch) | `success` — `quality` 1m43s, `e2e` 1m7s | GitHub Actions |
| CI run `35485192884` (`main` after #176) | `success` | GitHub Actions |

## 7. Simulation boundaries

- **No live service in any gate.** Stellar Testnet, Horizon, Supabase and LLM providers are unreachable from the pull-request path by construction, and the guard turns an accidental call into a test failure.
- **The double is not a backend.** `stub-api-server.mjs` exists only for browser tests; it is not imported by any application code and is not deployed. The real `apps/api` endpoints for SME requests are still pending (Feature #18), which is why the web gateway's paths remain documented placeholders.
- **The demo's labels are untouched.** Feature #15 added no user-visible behavior and no new copy. The environment chrome delivered by Feature #17 (`DEMO`, `TESTNET · Activos sin valor económico`) is asserted by the E2E suite, not changed by it; the stub's data carries the `SIMULADO` label the application renders.
- **No secrets were introduced.** The workflow requires none, references `secrets.` nowhere, and no test fixture contains a credential.

## 8. Limits and accepted risks

- **#48 is not merged when this document is written.** The 25 meta-tests live on PR #178, so the root-suite count on `main` is 23 until that PR merges. This document says so rather than reporting a merged state that does not exist yet.
- **The meta-tests are text-level assertions, not a parser.** They guard against the realistic regression (someone drops `--frozen-lockfile`, adds a second browser, or introduces a clock into the double). They are not an adversarial defence against deliberate obfuscation; that would need an AST-level check.
- **E2E runs against `next dev`, not a production build.** The gate validates behavior and the local-double boundary, not the production bundle. Vercel's preview build is a separate check.
- **Chromium only.** A single engine is a deliberate scope decision (`deploy-planning.md` §Parte 4); cross-browser coverage is out of scope for the demo.
- **No coverage thresholds.** The gates enforce that tests pass, not a coverage percentage.
- **Root `tests/**` is not covered by `turbo run lint`.** No workspace includes that directory, so ESLint must be run explicitly on those files. Worth a follow-up if more root-level meta-tests are added.
- **PR #177 (roadmap/README sync) is adjacent, not part of Feature #15.** It corrected the test-file count and the "#47 paused" claim; the count moved 74 → 75 again when #48 added a file.

## 9. Delivery state

- This document is the single work unit of Task #49, on branch `Vaqcrow#49_Task_Document_evidence_set_up_deterministic_testing_and_ci_gates`, based on `main` at `e3ca3e8`.
- It closes Feature #15 once merged, together with #47 (merged) and #48 (PR #178).
- `docs/planning/demo-tasks-list.md` is not modified here; roadmap sync belongs to a later commit, as in the #62 precedent.
