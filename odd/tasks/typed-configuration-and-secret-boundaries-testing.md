# Test the typed configuration and secret boundaries (issue #45)

## Objective
Prove the #44 implementation slice with deterministic tests (GitHub issue #45, the Test task of
Feature #14). Acceptance criteria are the contract:

1. **Deterministic coverage demonstrates the core behavior for Feature #14.**
2. **Rejection or failure behavior is covered where the feature has a safety boundary.**
3. **The test suite is reproducible without live external services.**

## Constraints
- Node 24 (`>=24 <25`); pnpm 11.27.0 pinned. Commands prefixed with
  `PATH="/opt/homebrew/opt/node@24/bin:$PATH"` when the shell lacks it.
- Artifacts/code/tests in English. Conventional commits, no AI attribution.
- No PR gate may depend on Testnet, Horizon, Supabase or an LLM provider.
- Test task: no production behaviour is added. The one production-file change is a comment.

## Shared gate — skills / MCP discovery
**Not applicable: no manifest or lockfile was mutated.** No dependency was added; the tests use
Vitest, already present. `skill_resolution: none`, `mcp_support: none`.
Note: the 8 Stellar skills installed project-level in PR #186 are **not** relevant here — no Stellar
work is involved in this unit, which is why they are not loaded.

## Gap analysis before writing anything
#44 already shipped 32 focused tests. The honest question was what those do **not** cover, measured
rather than assumed:

- **The browser boundary had zero coverage.** Feature #14's objective explicitly includes keeping
  server secrets out of browser bundles, and nothing verified it. This is the largest gap.
- **The rejection matrix was sampled, not exhaustive** — one key tested for blank/missing, hostile
  values chosen ad hoc.
- **`redactForLog` has no production consumer.** Grep confirmed it appears only in the compiled
  `.d.ts`. Redaction exists, is tested, and nothing redacts. Recorded as a bounded limitation.
- **Root `tests/**` is outside static analysis.** There is no root `tsconfig.json`, and
  `turbo run lint` / `turbo run typecheck` only walk workspaces, so a root test file is executed but
  never typechecked or linted. Written accordingly.

## Tasks
- [x] T1 Gap analysis against #44's existing coverage
- [x] T2 Branch `Vaqcrow#45_Task_Test_establish_typed_configuration_and_secret_boundaries` from `main` (`3b9a82e`)
- [x] T3 Moved #45 `Backlog` → `Ready` in Project #4 (verified)
- [x] T4 `tests/config-secret-boundaries.test.ts` — the browser bundle boundary (4 tests)
- [x] T5 `apps/api/src/application/config/config-matrix.test.ts` — exhaustive accept/reject/fallback + parse→redact (72 tests)
- [x] T6 Mutation-tested the new boundary tests (see below)
- [x] T7 Comment on `redaction.ts` recording that it has no consumer yet
- [x] T8 `pnpm run verify` exit 0

## The browser boundary is enforced, and proven to be
The two boundary tests could pass for the wrong reason. They were **mutation-tested**: a probe file
was planted in `apps/web/src` reading `process.env["SUPABASE_SERVICE_ROLE_KEY"]` and containing the
key name as a literal.

```
× lets apps/web read only NEXT_PUBLIC_* environment keys
  → apps/web/src reads non-public environment keys: SUPABASE_SERVICE_ROLE_KEY …
× keeps every server-side credential name out of apps/web sources
  → server credential names appear in web sources: __boundary-probe.ts (SUPABASE_SERVICE_ROLE_KEY) …
Tests  2 failed | 50 passed (52)
```

Both failed, each naming the offending file and key. The probe was then removed and the suite
returned to green. The boundary is *enforced*, not asserted.

The tests also derive their own input: `serverEnvironmentKeys()` reads the key literals out of the
API's configuration contract, and two "scanners themselves" tests assert the scan finds something
(including `SUPABASE_SERVICE_ROLE_KEY`). A boundary test that silently stops matching is worse than
no test, so the detectors are themselves under test.

**Deliberate scope of the name check.** Derived keys are filtered to secret-shaped names
(`SECRET|TOKEN|PASSWORD|PASSPHRASE|CREDENTIAL|PRIVATE_KEY|SERVICE_ROLE|AUTHORIZATION`), so
`SUPABASE_PUBLISHABLE_KEY` is not treated as a leak — it is browser-safe by design. The primary rule
is the stronger one: every key read in `apps/web/src` must start with `NEXT_PUBLIC_`.

## RED → GREEN
- **RED.** The first run of `config-matrix.test.ts` failed one test: `redactForLog` masks
  `networkPassphrase` to `[redacted]`. Root cause: `isSensitiveKey` normalises the key to
  `networkpassphrase`, which contains `passphrase`, so the key-name net catches it.
- **GREEN.** Not "fixed" by weakening the heuristic. The heuristic cannot distinguish a public
  network passphrase from a secret one, so erring toward masking is the correct default — the same
  choice that keeps a real passphrase out of a log. The test now asserts the **observed** behaviour
  and, more importantly, that the criterion Feature #14 actually needs still holds: the network
  identity survives in `network` and `horizonUrl`.
- **Three of my own test expectations were wrong before any of this** and were corrected rather than
  coerced into passing: the `PORT` block asserted acceptance under a "rejects" name, `preview` was
  listed as invalid though it is a supported environment, and most Horizon URLs were expected to be
  `invalid` when they are `unsupported`.

## Verified results
- `pnpm run verify` → **exit 0**.
  - `@vaqcrow/api` 8 files / **163** tests (was 7 / 91; `config-matrix.test.ts` adds 72)
  - root boundary suite 4 files / **52** tests (was 3 / 48; adds 4)
  - `@vaqcrow/domain` 60 · `@vaqcrow/contracts` 101 · `@vaqcrow/web` 317
  - `depcruise` → no violations (222 modules, 512 dependencies cruised)
- Every fixture is a literal; no test performs I/O. Reproducible with no service reachable.

## Bounded limitations (for #46 to carry honestly)
1. **`redactForLog` still has no production consumer.** Wiring belongs to #31 (resilience and
   telemetry) — the API runs with Fastify's logger disabled. Impact today is zero; the contract is
   proven so that wiring step has a verified boundary to call.
2. **The network passphrase is masked** by the key-name heuristic. Network identity survives, so
   Feature #14's "Testnet context is explicit" criterion still holds. An allowlist for published
   public constants is a decision for #31, when there is an actual log line to inspect.
3. **The boundary is enforced at the source, not in a built bundle.** A build-and-scan check would
   be stronger but would put a web build inside a PR-gated unit suite. The source rule is the
   enforceable proxy: Next.js inlines only `NEXT_PUBLIC_*`, and the rule forbids anything else being
   read at all.
4. **Root `tests/**` gets no static analysis** (no root tsconfig; turbo covers workspaces only). The
   new root test file is executed by `test:boundaries` but is neither typechecked nor linted. A gate
   gap worth an issue; not expanded here.

## Next step
#46 documents Feature #14's closing evidence in `docs/planning/`, using this log for the results and
carrying the three bounded limitations above.
