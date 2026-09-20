# Typed configuration and secret boundaries (issue #44)

## Objective
Implement GitHub issue #44 — the implementation slice of Feature #14, "Establish typed configuration
and secret boundaries". The Feature's acceptance criteria are the real contract (the Task body is
boilerplate), so this work unit delivers:

1. **Missing config fails clearly** — one aggregated, value-free failure report.
2. **Testnet context is explicit** — the network is a closed set of one, validated at startup.
3. **Sensitive log values are redacted** — a `Secret` boundary plus log-structure redaction.

## Constraints
- Node 24 (`>=24 <25`); pnpm 11.27.0 pinned. Commands prefixed with
  `PATH="/opt/homebrew/opt/node@24/bin:$PATH"` when the shell lacks it.
- Artifacts/code/tests/docs in English. Conventional commits, no AI attribution.
- DEMO.md §Entornos y secretos is the scope source: Local/CI, Preview, Demo are in; "Producción
  futura" is explicitly out of scope.
- Boundaries (`.dependency-cruiser.cjs`): `apps/api/src/application/` may not import Fastify,
  Supabase, Stellar or LLM SDKs except type-only — so the config contract is written with zero
  provider imports and reads from an injected record, never `process.env`.
- `pnpm run verify` must stay free of Testnet, Horizon, Supabase and LLM providers.

## Shared gate — skills / MCP discovery
**Not applicable: no manifest or lockfile was mutated.** This work unit adds no dependency — the
parser is plain TypeScript and the tests use Vitest, already present. No skill or MCP support was
required to write it. Recorded as `skill_resolution: none`, `mcp_support: none`.

## Design decisions
- **Placement.** The contract lives in `apps/api/src/application/config/`, not in a new
  `packages/config`. That package is listed in `docs/architecture/monorepo.md` as authorised but
  **not built**; creating it would expand scope beyond the Task. `packages/contracts` was rejected
  too — its exports must stay portable to browser consumers, and a Node-oriented, `process.env`-aware
  config contract does not belong there.
- **Parsers read an injected `EnvSource`, never `process.env`.** Keeps `application/` pure and lets
  tests exercise hostile configuration without mutating global state.
- **The adapter receives validated configuration, not raw env.** `createSupabaseClient(config)`
  replaced `createSupabaseClient(env)` so there is exactly one validation path and a credential
  cannot reach `createClient` without crossing `Secret` first. The `Secret.reveal()` call is the
  single greppable point of use.
- **`STELLAR_NETWORK` is required and closed to `"testnet"`.** If the network could be absent, the
  guard could be bypassed by omission and something downstream might default to the public network.
  A security boundary should be opt-out, never opt-in. Public Testnet constants (Horizon URL,
  network passphrase) are not secrets and stay in source.
- **Horizon URL is optional but constrained.** Absent ⇒ canonical Testnet host; present ⇒ must
  resolve to the Testnet host, or to loopback (http allowed) for a local double. Anything else is
  `unsupported`.
- **`APP_ENV=production` is rejected, with that reason named.** Encodes DEMO.md's out-of-scope row at
  the config boundary instead of relying on prose.
- **`SUPABASE_PUBLISHABLE_KEY` is optional in the Supabase slice.** The server process does not serve
  the browser; the key is required only by `createPublishableSupabaseClient`, which fails clearly.
- **The failure report never echoes a value.** Not a convention but a testable invariant: the
  assertion is `message` does not contain a sentinel supplied as the offending value.
- **Redaction leaves traceability identifiers intact.** `correlationId` / `applicationId` / dashed
  UUIDs survive; a redaction layer that hides everything is as useless as one that hides nothing.

## Tasks
- [x] T1 Recon: #44, Feature #14, roadmap entry, existing `process.env` sites, CI + test configs
- [x] T2 `application/config/secret.ts` — `Secret` boundary (`reveal()` only; `toJSON`/`toString` marker)
- [x] T3 `application/config/config-issue.ts` — `ConfigIssue` + `ConfigurationError` (value-free report)
- [x] T4 `application/config/env-source.ts` — `EnvSource`, `ParseResult`, issue helpers
- [x] T5 `application/config/stellar-config.ts` — required, closed Testnet network + Horizon guard
- [x] T6 `application/config/supabase-config.ts` — persistence slice, keys wrapped as `Secret`
- [x] T7 `application/config/api-config.ts` — aggregate `parseApiConfig` (env/port/log level)
- [x] T8 `application/config/redaction.ts` — `redactText`, `isSensitiveKey`, `redactForLog` (depth cap)
- [x] T9 Wire `index.ts` + `create-supabase-client.ts`; update integration client support
- [x] T10 Focused tests: `api-config.test.ts` (21), `redaction.test.ts` (11)
- [x] T11 `.env.example` documents the validated surface
- [x] T12 `pnpm run verify` exit 0

## RED → GREEN
- **RED (found by the gate, not by me).** `pnpm run typecheck` failed on a pre-existing
  `apps/api/src/infrastructure/supabase/create-supabase-client.test.ts` I had not read during recon:
  six TS2353 errors, because the adapter's parameter changed from `ProcessEnv` to `SupabaseConfig`.
  The gate caught an incomplete recon — the honest lesson is that a file listing is not a survey.
- **GREEN.** That test was rewritten to assert the new contract rather than deleted: the pipeline
  still proves "missing key ⇒ clear failure, `createClient` never called", and now additionally
  proves the parsed config cannot leak the key through `JSON.stringify`. Coverage was re-targeted,
  not lost (6 tests → 4, with the validation assertion moved to its rightful layer).
- `pnpm --filter @vaqcrow/api exec vitest run src/application/config` — 2 files, 32 tests, pass (6ms).

## Progress / evidence
- 2026-09-20: branch `Vaqcrow#44_Task_Implement_typed_configuration_and_secret_boundaries` from `main`
  (`e010406`). Recon, T2–T12.
- `pnpm run verify` exit 0 (Node 24.21.0 / pnpm 11.27.0):
  - `@vaqcrow/domain` 60 · `@vaqcrow/contracts` 101 · `@vaqcrow/web` 317 · `@vaqcrow/api` **91** ·
    boundary fixture tests 48 — all passed.
  - `depcruise` — no dependency violations (221 modules, 504 dependencies cruised).
  - `@vaqcrow/api` test suite 5 files / 61 tests → **7 files / 91 tests** on this branch.
- No secret, seed, PII or real credential appears in the diff: every fixture is synthetic and every
  test value is a literal such as `service-role-fixture`.
- **Not run:** `test:integration` (credential-gated; requires live Supabase). It was updated to the
  new parser (`parseSupabaseConfig(process.env)`) and is covered by `typecheck`, but a live run was
  not performed and is not claimed. This is the one bounded limitation of this work unit.

## Next step
T2–T12 delivered. #45 (Test) extends the deterministic matrix — the rejection/fallback surface and
the web-side "no server secret in a browser bundle" guard; #46 documents Feature-closing evidence in
`docs/planning/`.

## Review size and delivery chain
~961 authored lines total (890 new files, 556 production / 334 test; 71 insertions in modified files).
Over the 400-line heuristic, so the work is sliced into a **two-PR stacked chain to `main`** — the
strategy the decision gate selects when each slice can land independently, and the one the repo
already uses (`#176` and `#179`, both Task PRs with base `main`; no Feature integration branch has
ever been used).

| Slice | Branch | Contents | Lines |
|---|---|---|---|
| 1 — contract | `Vaqcrow#44_Task_Implement_typed_configuration_and_secret_boundaries` | `apps/api/src/application/config/**` (7 modules + 2 test files) | ~890 |
| 2 — wiring | `…-02-wiring` | `index.ts`, `create-supabase-client` (+ test), integration client support, `.env.example`, this log | ~130 |

**Slice 1 is still ~890 lines, i.e. over budget, and that is reported rather than hidden.** The
reason is structural: the `Secret` type, the issue vocabulary and the parsers form one dependency
chain — `parseApiConfig` cannot exist without the issue collector and the slices it aggregates, and
nothing in the slice has a runtime effect until slice 2 imports it. The overage therefore sits
entirely in the slice that **cannot change behaviour**: every file is additive and unimported, so it
carries no runtime risk and no rollback surface. Compressing the comments, tests or blank lines to
reach the number would remove the reasoning the reviewer needs, which the slicing rules forbid.

Two honest alternatives, if the reviewer prefers:
- `size:exception` on slice 1 with the additive-risk argument above.
- A four-slice chain (`secret`+`redaction`+issue vocabulary | config slices | aggregate parser |
  wiring) would bring every slice under 400, at the cost of splitting `api-config.test.ts` by
  concern. Offered, not taken unilaterally — the user chose two.

Slice 1 verifies standalone: `pnpm run verify` passes with no importer, proving the additive claim.

