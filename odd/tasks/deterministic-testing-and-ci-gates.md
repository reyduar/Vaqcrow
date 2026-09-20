# Deterministic testing and CI gates (issue #47)

## Objective
Implement GitHub issue #47: deterministic Vitest/Testing Library/Playwright configuration and
pull-request CI gates that use local doubles only. Pull-request verification must not depend on
live external services (Stellar Testnet, Horizon, Supabase, LLM providers).

## Constraints
- Node 24 (`>=24 <25`); pnpm 11.27.0 pinned. Commands prefixed with
  `PATH="/opt/homebrew/opt/node@24/bin:$PATH"` when the shell lacks it.
- Artifacts/code/tests/docs in English. Conventional commits, no AI attribution.
- Respect DEMO.md boundaries: synthetic data stays labeled, no secrets/seeds/PII, no production claims.
- Playwright browsers: Chromium only (deploy-planning.md §Parte 4 decision).
- Dependency boundaries (`.dependency-cruiser.cjs`) only scan `apps/*/src` and `packages/*/src`;
  `apps/web/e2e/**` is outside that scope and must not import `@vaqcrow/domain`.

## Shared gate — skills / MCP discovery (MANDATORY before any manifest or lockfile mutation)
Performed before touching `apps/web/package.json`, `pnpm-lock.yaml`, or adding any Playwright dependency.

- **Injected skills (session `<available_skills>`):** reviewed. No Playwright, browser-testing,
  Next.js, or CI-workflow skill is installed. Closest candidates are `go-testing` (Go only),
  `frontend-design` (visual direction) and the `heroui-*` skills (component library) — none apply.
- **Registry fallback (`.atl/skill-registry.md`, 21 entries):** same result. No matching skill.
- **Connected MCP servers inspected (`.mcp.json` + session tools):** `codegraph`, `context7`,
  `engram`, `github`, `supabase`, `vercel`, `stitch`. Applicable support: **`context7`** — used to
  fetch authoritative Playwright documentation (`/microsoft/playwright`) for `webServer`
  multi-server configuration, `reuseExistingServer`, `baseURL`, project/browser scoping and CI
  retry semantics, before writing `playwright.config.ts`.
- **Not used / explicitly out of scope:** the `playwright` MCP server (`@playwright/mcp`) is not
  connected and adding it is Phase 4 local-tooling work in `deploy-planning.md` ("Sin issue —
  configuración local de entorno, no scope funcional de la demo"). Discovery does not authorize
  that MCP configuration or any unrelated dependency.
- **`skill_resolution: none`** for skills; **MCP support used: `context7`**.

## Tasks
- [x] T1 Record gate (this file) — done before manifest mutation
- [x] T2 Add `@playwright/test` (1.63.0) to `apps/web` + `test:e2e` scripts
- [x] T3 `apps/web/playwright.config.ts` — Chromium only, 1 worker, retries 0, dual webServer (stub + next dev)
- [x] T4 `apps/web/e2e/support/stub-api-server.mjs` — frozen-literal local double (CORS, `/__reset`)
- [x] T5 E2E specs: `guided-journey.spec.ts` (4) + `human-decision.spec.ts` (4) + `support/local-only.ts` guard (no external hosts)
- [x] T6 `.github/workflows/ci.yml` — quality (`pnpm verify`) + e2e jobs, both `--frozen-lockfile`
- [x] T7 Documented commands: root `test:e2e` / `test:e2e:install`, turbo `test:e2e` task (`dependsOn: ^build`), README §Stack + §Desarrollo y calidad
- [x] T8 `pnpm run verify` exit 0; `pnpm run test:e2e` 8/8 passed (also after deleting `packages/*/dist` to prove turbo builds deps)

## Progress / evidence
- 2026-09-19: recon + gate recorded; branch `Vaqcrow#47_Task_Implement_set_up_deterministic_testing_and_ci_gates` from `main` (65b0305).
- 2026-09-19: T2-T8 done and verified locally (Node 24.21.0 / pnpm 11.27.0). E2E 8/8 in ~10s.
- Determinism controls: Chromium only, `workers: 1`, `fullyParallel: false`, `retries: 0`,
  `forbidOnly` in CI, frozen stub literals (no `Date.now`/`Math.random`), `POST /__reset` per test.
- Boundary guard: `support/local-only.ts` auto-fixture fails any test whose browser requests a
  non-loopback host — the "no live external services" criterion is enforced, not just claimed.
- Untouched on purpose: `README.md` test-file count line and `docs/planning/demo-tasks-list.md`
  (the unmerged `docs/documentation-state-and-agent-guidance` commit `eb11a49` already edits them).

## Next step
T2-T8 delivered. #48 (Test) validates this slice; #49 documents evidence.

## Delivery
- Commits (work units, branch `Vaqcrow#47_Task_Implement_set_up_deterministic_testing_and_ci_gates`):
  - `d56f795` test(web): deterministic Playwright E2E suite with a local API double
  - `b9c4b23` ci: gate pull requests with frozen install and deterministic Playwright
  - `d253e07` docs(readme): document deterministic test and CI commands
- PR [#176](https://github.com/reyduar/Vaqcrow/pull/176) (base `main`, labels `type:task`, `area:testing`, `area:infra`).
- CI on the PR: `quality` pass (1m31s), `e2e` pass (1m13s) on the first run — the whole
  design (frozen install, turbo dependency build, `next dev`, stub double, no external hosts)
  validated on ubuntu-latest.
- Review size ~510 authored lines; first commit ~430, just over the 400 heuristic. Reported in
  the PR body with a `size:exception` alternative; not compressed to fit.

## #48 — Test the deterministic testing and CI gates
- **Objective:** prove the #47 slice with deterministic tests (successful, rejected and fallback
  behavior), with pull-request verification independent of Testnet, Horizon and any live LLM.
- **Shape:** meta-tests over the gate artifacts, because the app behavior is already covered by the
  E2E suite — what nothing proved is that the gates stay deterministic and secret-free.
- [x] T1 RED first: `vitest run tests/testing-and-ci-gates.test.ts` failed with
  `Cannot find module '../apps/web/e2e/support/local-hosts'`
- [x] T2 Extract the guard predicate to `apps/web/e2e/support/local-hosts.ts` (no `@playwright/test`
  import, so the root suite can import it) and make `local-only.ts` consume it, behavior unchanged
- [x] T3 `tests/testing-and-ci-gates.test.ts` — 25 cases over the CI workflow, the Playwright
  config, the stub double, the script/task wiring, the documented commands, and the E2E boundary
- [x] T4 Rejection coverage: loopback acceptance (`127.0.0.1`, `localhost`, `[::1]`, credentials in
  URL), `data:`/`blob:`, the hosts a regression could reach (Horizon, Supabase, OpenAI,
  stellar.org, freighter.app), and hosts that merely contain a loopback string
  (`127.0.0.1.evil.com`) — the case a `startsWith`/`includes` check would have accepted
- [x] T5 REFACTOR after a false positive: the stub-determinism regex matched `Date.now` inside the
  stub's own docstring, so source-text assertions now run through `withoutComments` (block comments
  plus whole-line `//`; inline `//` left alone so a naive strip cannot truncate `http://127.0.0.1`)
- **Verification:** RED observed, then 25 passed; `pnpm run verify` exit 0 (root suite 3 files /
  48 tests; api 61; web 317; boundaries clean at 216 modules); `pnpm run test:e2e` 8/8 in ~12s;
  web typecheck and eslint on the changed files clean.
- **Delivery:** commit `9054fbe` (`test(gates): prove the deterministic testing and CI gates`),
  one work unit — the predicate extraction and its consumer cannot be separated, and the README
  count change comes from this same commit. PR
  [#178](https://github.com/reyduar/Vaqcrow/pull/178) (base `main`, `type:task` + `area:testing`);
  CI `quality` pass (1m43s), `e2e` pass (1m7s).
- **Note:** the README test-file count moved 74 → 75 because this task adds one file; the count was
  corrected in the same commit that invalidated it.

## #49 — Document evidence for the deterministic testing and CI gates
- **Objective:** publish reproducible, bounded evidence for Feature #15 with the verification method
  and the observed result, excluding sensitive data and unsupported claims.
- **Deliverable:** `docs/planning/deterministic-testing-and-ci-gates-evidence.md` (107 lines,
  English, structure §1–§9 following the #62 evidence document).
- **Format check:** the #62 document states "code, tests and this document are English" — evidence
  docs are English even though `demo-tasks-list.md` and the README are Spanish.
- [x] T1 Read the established format before writing, rather than inventing a structure
- [x] T2 Re-run the reproducible commands in this working tree: `pnpm install --frozen-lockfile`
  (exit 0), `pnpm run verify` (exit 0; domain 1/60, contracts 5/101, api 5/61, web 59/317,
  boundaries 216 modules/481 dependencies), `pnpm run test:e2e` (8 passed, ~12s)
- [x] T3 Cite the CI runs with URLs: `35479682438` (#47 branch), `35485729460` (#48 branch),
  `35485192884` (main after #176) — all `success`
- [x] T4 Record the skill/MCP gate (section 5, item 6) as #47's criteria require
- [x] T5 State the limits honestly, including that #48 is unmerged
- **Accuracy decision:** this branch is based on `main` (`e3ca3e8`), where #47 is merged and #48 is
  not, so the root suite here is 2 files / 23 tests while the #48 branch reports 3 files / 48. The
  document reports the #48 numbers **with their source** instead of claiming a merged state that
  does not exist, and section 8 says so explicitly. Once PR #178 merges, every number becomes
  reproducible from `main`.
- **Doc checks:** `git diff --check` clean; secret scan clean (no `sb_secret`, JWT, key, Supabase
  project ref or seed); Obsidian syntax correct (2 callouts, 1 piped wikilink).
- **Delivery:** commit `6b86b77` (`docs(planning): add deterministic testing and CI gates evidence`),
  single work unit. PR [#179](https://github.com/reyduar/Vaqcrow/pull/179) (base `main`,
  `type:task` + `area:testing` + `area:docs`); CI `quality` pass (1m51s), `e2e` pass (1m10s).
- **Closes Feature #15** once merged, together with #47 (merged) and #48 (PR #178).




