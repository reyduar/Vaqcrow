# T6 follow-up: preflight contract alignment, retired risk, and document alignment

## Objective

Close three defects found while running `pnpm demo:preflight` against the real
environment after T6 (see `complete-vertical-demo-journey.md`):

1. The preflight demands two variables the API treats as **optional**
   (`STELLAR_HORIZON_URL`, `STELLAR_RPC_URL`), producing four spurious red checks
   out of nine, and skipping the Horizon and RPC probes that could have run.
2. `docs/planning/demo-run-preflight.md` §6 states as an **open** risk that the
   platform-key ↔ factory-`owner` correspondence was never exercised against the
   hosted deployment. It was proven on 2026-09-25. The runbook inherited a stale
   claim from `docs/architecture/cloud-demo-architecture.md` §7 limitation 5.
3. AGENTS.md / CLAUDE.md do not tell an agent which documents must be kept
   aligned, nor which claims must be cross-checked before being written or
   approved. Both defects above are exactly that class of error.

## Problem

`scripts/demo/preflight/preflight.mjs:13-26` lists `STELLAR_HORIZON_URL` and
`STELLAR_RPC_URL` in `REQUIRED_API_ENV`. `apps/api/src/application/config/stellar-config.ts`
`resolveHorizonUrl` (`:194-239`) and `resolveRpcUrl` (`:246-291`) both return the
canonical Testnet endpoint when the variable is absent
(`STELLAR_TESTNET_HORIZON_URL` `:34`, `STELLAR_TESTNET_RPC_URL` `:36`). The API
boots without them; `typed-configuration-and-secret-boundaries-evidence.md:36`
already documents `STELLAR_HORIZON_URL` as optional. The preflight contradicts
both the code and the written evidence.

The false negative cascades: because the Horizon check (`:265`) and the RPC
checks (`:279`, `:295`) also fail on "not set" rather than falling back, one
over-strict requirement produces four red checks.

The factual defect has a clean timeline: `ea7d82f` (2026-09-25 **08:22**) wrote
"no se ejercitó contra el despliegue hosteado"; `0aa2d6c` (same day, **11:49**)
recorded that it had been exercised. `odd/tasks/hosted-vault-configuration-closure.md`
closes it explicitly ("This closes #287's hardest criterion"), and T6 re-ran it
(`campaign-vault-web-journey-evidence.md:58`).

## Why

The preflight is the gate an operator runs immediately before a timed demo run.
A false red trains the operator to ignore red, and a false "unproven risk" makes
the operator schedule a rehearsal that is not needed. Both reduce the signal the
tool exists to provide.

## Scope

In scope:

- `scripts/demo/preflight/preflight.mjs` — required-name set and the Horizon/RPC
  fallbacks.
- `tests/demo-preflight.test.ts` — update and extend.
- `docs/planning/demo-run-preflight.md` — §2.2, §3, §6.
- `docs/architecture/cloud-demo-architecture.md` — §5 prose and §7 limitation 5.
- `AGENTS.md` and `CLAUDE.md` (byte-identical twins; both must change together).
- `odd/tasks/complete-vertical-demo-journey.md` — T6 follow-up entry.

Out of scope / explicitly not touched:

- No new preflight checks, no change to the read-only guarantee (only GET/HEAD
  and the JSON-RPC methods `getHealth`, `getNetwork`, `getLedgerEntries`).
- No change to any `apps/api` config module: the API contract is the source of
  truth and the preflight is the thing that is wrong.
- No `.env.cloud` edit: those secrets live on Railway/Vercel and this repository
  never holds them.
- The `503`-instead-of-`400` on a malformed campaign id (recorded in
  `cloud-environment-configuration-evidence.md` §5.6) stays a known limit.

## Constraints

- Artifacts in English (`scripts/`, `tests/`); the two planning/architecture docs
  stay Spanish, matching their corpus. AGENTS.md/CLAUDE.md stay English.
- The preflight constants that mirror `apps/api` must name the module they mirror
  in a comment, so the next reader knows the pair to keep in sync.
- No secrets in reports: the existing redaction (`SECRET_ENV_NAMES`) is untouched.
- Documentation must not re-state a claim the evidence corpus contradicts.

## Tasks

- [x] **A1** — `REQUIRED_API_ENV` drops `STELLAR_HORIZON_URL` and
  `STELLAR_RPC_URL`; its doc comment states the real intent (names whose absence
  breaks the *hosted journey*, not names needed to boot). `CORS_ALLOWED_ORIGINS`
  stays: absent means an empty allow-list outside `local`
  (`cors-config.ts:32-35`), which blocks the browser and does break the journey.
  *Route: delegated writer.*
- [x] **A2** — export `STELLAR_TESTNET_HORIZON_URL` / `STELLAR_TESTNET_RPC_URL`
  mirroring `stellar-config.ts:34,36`, with a comment naming the source module.
  The Horizon and RPC checks fall back to them and **probe** instead of failing
  with "not set"; the check detail names the canonical default as the source.
  *Route: delegated writer.*
- [x] **A3** — tests: the required-name assertions updated; new cases for
  (a) a journey-critical-only env going green, (b) Horizon/RPC still probing the
  canonical URLs when unset (assert the URL the injected `fetch` received),
  (c) the report naming the canonical default. No test touches a real service.
  *Route: delegated writer.*
- [x] **A4** — runbook §6 rewritten: the risk is **retired**, with the vault,
  tx (`845f9040ebbab2…0672d5`), ledger (4864817) and the three verification
  layers; what genuinely remains is the 2026-12-16 Testnet reset invalidating the
  contract addresses, and the browser end-to-end, which is still unrun.
  *Route: delegated writer.*
- [x] **A5** — runbook §2.2 and §3: state where each name actually lives (the
  campaign pair and CORS on the hosted API service, `NEXT_PUBLIC_API_BASE_URL` on
  the web host, the Supabase/LLM/network subset in the local profile), that
  Horizon/RPC are optional with canonical Testnet defaults, and what the example
  command will report against a local profile alone.
  *Route: delegated writer.*
- [x] **A6** — `cloud-demo-architecture.md`: §5 prose (the correspondence is
  proven, not pending) and §7 limitation 5 retired, pointing at the evidence.
  *Route: delegated writer.*
- [x] **A7** — AGENTS.md + CLAUDE.md: a short, bounded section recording the
  document-alignment rule (which docs must be checked and kept aligned, and that
  a "proven / never exercised / required-variable" claim must be cross-checked
  against the evidence corpus and the code before it is written or approved) plus
  the standing decisions already settled, so no agent relitigates them.
  *Route: delegated writer.*
- [ ] **A8** — `complete-vertical-demo-journey.md`: T6 follow-up entry.
  *Route: parent, after the commits exist.*

## Acceptance criteria

1. `pnpm demo:preflight --env-file .env.cloud` no longer reports
   `STELLAR_HORIZON_URL` / `STELLAR_RPC_URL` as missing, and the Horizon and RPC
   checks report a real probe result instead of "not set".
2. `STELLAR_HORIZON_URL` and `STELLAR_RPC_URL` appear nowhere in the
   required-name list; the exported canonical constants name
   `apps/api/src/application/config/stellar-config.ts` as their source.
3. No document in the repository states that the platform-key ↔ factory-`owner`
   correspondence is unproven.
4. AGENTS.md and CLAUDE.md remain byte-identical and name the documents that
   must be kept aligned.
5. `pnpm run verify` passes.

## Checks

- `pnpm exec vitest run tests/demo-preflight.test.ts`
- `pnpm run lint`, `pnpm run lint:tests`, `pnpm run typecheck:tests`
- `pnpm run verify`
- `node scripts/demo/preflight/cli.mjs --env-file .env.cloud --json` (read-only,
  against the real environment, to see the corrected report)

## Decisions (2026-09-30, user)

- Fix code, tests and docs **together**, in one work unit.
- The preflight mirrors the API config contract; when one changes the other and
  its tests change with it.
- Record the document-alignment rule and the settled decisions in AGENTS.md and
  CLAUDE.md so any agent knows which documents to check and align.
- Commit as work units on the current branch. Push and PR remain the user's call.

## Progress

- [x] Defects found and evidenced (preflight over-strict; runbook §6 false).
- [x] Implementation (A1–A7).
- [x] Verification (all commands run, results below).
- [x] Commits (work units 1–4; this record closes in a fifth commit).

Work-unit commits on `Vaqcrow#95_Task_Implement_complete_vertical_demo_journey-09-demo-reset`:

| # | Commit | Subject |
|---|---|---|
| 1 | `7aedfc0` | `fix(scripts): stop requiring the optional Stellar endpoints in the preflight` (A1+A2+A3) |
| 2 | `3a27b8c` | `docs(planning): retire the factory-owner risk and record where the demo variables live` (A4+A5) |
| 3 | `6111025` | `docs(architecture): drop the stale factory-owner limitation` (A6) |
| 4 | `8eac982` | `docs(agents): record the document-alignment rule and the settled decisions` (A7) |
| 5 | _(this record)_ | `docs(odd): record the preflight and document-alignment work` |

## Verification evidence

All commands were run in the foreground in the working tree on 2026-09-30.

### Strict TDD (A1–A3)

- **RED** — after writing the new tests and before touching `preflight.mjs`:
  `pnpm exec vitest run tests/demo-preflight.test.ts` → **4 failed | 47 passed (51)**. The four failures were the four new cases: the required-name list still contained `STELLAR_HORIZON_URL`, the journey-critical-only env was not green, the horizon/rpc checks returned `… is not set`, and the detail did not name the canonical URL.
- **GREEN** — after implementing A1+A2:
  `pnpm exec vitest run tests/demo-preflight.test.ts` → **50 passed (50)**. The count moved 47 → 49 (four new cases added, two `it.each` rows removed with the two names) and then 49 → 50 with the export-identity assertion for the mirrored constants.

### Commands

| Command | Observed result |
|---|---|
| `pnpm exec vitest run tests/demo-preflight.test.ts` | `Test Files 1 passed (1)`, `Tests 50 passed (50)` |
| `pnpm run lint` | `Tasks: 5 successful, 5 total`; one pre-existing unrelated warning in `apps/web/src/infrastructure/http/fetch-http-client.ts` (`_request` unused), present on the untouched base |
| `pnpm run lint:tests` | clean (no findings) |
| `pnpm run typecheck:tests` | clean (no findings) |
| `pnpm run verify` | `VERIFY_EXIT=0`; 10 test files / 143 tests passed, dependency-cruiser `no dependency violations found (549 modules)`, all builds successful |
| `node scripts/demo/preflight/cli.mjs --env-file .env.cloud --json` | exit **1** (expected: hosted-only values absent locally), with the corrected lines below |

### Corrected preflight output (`.env.cloud`, read-only)

```text
FAIL env-api — missing: STELLAR_CAMPAIGN_FACTORY_ID, STELLAR_PLATFORM_SECRET_KEY, CORS_ALLOWED_ORIGINS
FAIL env-web — missing: NEXT_PUBLIC_API_BASE_URL
FAIL api-health — no API URL (set NEXT_PUBLIC_API_BASE_URL or --api)
PASS horizon — HTTP 200, Testnet passphrase (canonical Testnet default https://horizon-testnet.stellar.org; STELLAR_HORIZON_URL unset)
PASS rpc — healthy, Testnet passphrase (canonical Testnet default https://soroban-testnet.stellar.org; STELLAR_RPC_URL unset)
FAIL factory — STELLAR_CAMPAIGN_FACTORY_ID is not set
FAIL account-platform — no platform account (set STELLAR_PLATFORM_SECRET_KEY or --platform)
FAIL account-sme — no SME account (pass --sme or set DEMO_SME_PUBLIC_KEY)
FAIL account-investor — no investor account (pass --investor or set DEMO_INVESTOR_PUBLIC_KEYS)
PASS schema-tables — 7 tables readable
PASS schema-distribution-columns — both columns selectable
```

Before the change the same command reported **9 failures including
`STELLAR_HORIZON_URL` / `STELLAR_RPC_URL` in `env-api` and the two "is not set"
probe failures**; those four are gone. The remaining failures are the genuinely
absent hosted-only values (`STELLAR_CAMPAIGN_FACTORY_ID`,
`STELLAR_PLATFORM_SECRET_KEY`, `CORS_ALLOWED_ORIGINS`,
`NEXT_PUBLIC_API_BASE_URL`) and the demo accounts, which is the honest reading
the runbook now documents (§2.2, §3). The `.env.cloud` profile holds only
`APP_ENV`, `LLM_*`, `LOG_LEVEL`, `PORT`, `STELLAR_NETWORK`, `SUPABASE_*`, read
as names only — no secret value was printed.

### Byte-identical twins (A7)

`shasum -a 256 AGENTS.md CLAUDE.md` → both
`3bd7a3b559ffb928fc4aa7929615ed7d1164518033bad6059becdf25f73430f9`; `diff -q` reports no difference.
