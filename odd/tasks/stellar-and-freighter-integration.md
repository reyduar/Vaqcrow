# Stellar and Freighter integration (issue #23)

## Objective
Deliver GitHub issue #23 — Feature "Encapsulate Stellar and Freighter integration" — through its
ordered Tasks: #74 Implement → #75 Test → #76 Document evidence.

The Feature's three acceptance criteria are the real contract (the Task bodies are boilerplate):

1. **No private key path exists** — Vaqcrow never requests, receives or stores a seed, mnemonic or
   private key. Only public addresses and unsigned/signed XDR cross the boundary.
2. **network is explicit** — every Stellar call that depends on a network receives the Testnet
   passphrase as an argument, sourced from the validated config that #14 closed to `testnet`.
3. **rejection is recoverable** — a person declining in Freighter is a controlled, classified
   outcome the caller can report and retry, not an unhandled throw that poisons the flow.

## Constraints
- Node 24 (`>=24 <25`); pnpm 11.27.0 pinned. The system `node` is v26, so commands run with
  `PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"` (or the Homebrew `node@24` equivalent).
- Code, tests, commits and PR bodies in English. Conventional commits, no AI attribution.
- Boundaries (`.dependency-cruiser.cjs`), per `stellar-blockchain-requirements.md` Parte 4 §2:
  - `apps/web` uses **only** `@stellar/freighter-api`. `@stellar/stellar-sdk` must NOT appear there.
  - `apps/api` uses **only** `@stellar/stellar-sdk` (XDR/Horizon). `@stellar/freighter-api` must NOT
    appear there.
  - `application/` may not import either SDK — only `infrastructure/adapters/` may.
- `pnpm run verify` must stay free of Testnet, Horizon, Freighter and LLM providers.
- Issue #74's testing strategy: "Freighter double plus bounded Testnet check" — deterministic
  doubles in CI, and at most one bounded, manual Testnet observation for the evidence Task.

## Shared gate — skills / MCP discovery
`skill_resolution: skill-registry`. Two manifests and the lockfile were mutated, so the shared gate
applies. Matched from `.atl/skill-registry.md` by technology:

- `dapp` — Stellar client/SDK + Freighter adapter (loaded).
- `data` — Horizon querying, for the `apps/api` slice (loaded before that slice).

No MCP server was required for authoring; recorded as `mcp_support: none`.

## Design decisions

- **D1 — The Feature is delivered by its Tasks, in two review slices.** #74 spans two isolated
  workspaces with two different SDKs and no dependency between them, so it is split into
  `slice 1 = apps/web` (Freighter, owns criterion 3) and `slice 2 = apps/api` (stellar-sdk/Horizon,
  owns criterion 2's server side), stacked per the `chained-pr` skill's 400-line guidance.

- **D2 — `WalletError` lives in the port file, not in the adapter.** `http-client-port.ts` already
  sets this precedent (`HttpClientError` is declared with its port so `application/` can catch it
  without importing infrastructure). `WalletError` follows it: `application/` can discriminate a
  rejection without knowing Freighter exists.

- **D3 — Failure is classified, and `recoverable` is derived, not asserted.** `WalletFailureKind` is
  `rejected | unavailable | network_mismatch | unknown`; `recoverable` is `kind !== "unknown"`. The
  criterion is "rejection is recoverable", so the type must make `rejected` recoverable by
  construction rather than by a comment.

- **D4 — Rejection is detected by the documented message, not by a code.** Verified against the
  installed package and the official docs (2026-09-20): `@stellar/freighter-api@6.0.1` **never
  throws** for a declined request — it resolves `{ error }`. Both the decline and the internal
  failure carry `code: -1`, so the code cannot discriminate. The documented contract is the message:
  - user rejected → `"The user rejected this request."`
  - extension not installed → `"The wallet encountered an internal error…"`
  - non-browser host → `"Node environment is not supported"`
  `FreighterApiDeclinedError` is declared in the shipped `.d.ts` but is **not** present in the
  client bundle (`index.min.js`), so it is not importable — the message is the only stable signal.

- **D5 — The Freighter API is injected, defaulting to the real one.** `FreighterWallet(api = realApi)`
  lets the deterministic double from the Task's testing strategy drive every branch, while
  `presentation/components/workspace-status.tsx` keeps constructing `new FreighterWallet()` with no
  argument.

- **D6 — `signTransaction` verifies the wallet's network before requesting a signature.** The
  requirements doc (Parte 2 §4.6) requires confirming the active network before signing; a wallet on
  Mainnet is `network_mismatch`, raised *before* the person is asked to approve anything.

- **D7 — The passphrase argument is required and guarded non-empty.** "network is explicit" is
  enforced by the signature (no default) plus a runtime guard, so an omitted passphrase fails on the
  integration side instead of being silently defaulted by the SDK.

- **D8 — The workspace view model is NOT changed in this slice.** It already catches and recovers
  generically, so criterion 3 holds end to end. Surfacing `WalletError.kind` as differentiated UX
  belongs to the journey/dashboard Features (#30/#29), not to the integration Task. Recorded as an
  advisory below.

## Tasks
- [x] T1 Recon: #23/#74/#75/#76, roadmap entries, existing wallet/ledger stubs, boundaries, skills
- [x] T2 Assign #23 and #74; move both to `In progress` on Project #4
- [x] T3 Install `@stellar/stellar-sdk` (api) and `@stellar/freighter-api` (web)
- [x] T4 Verify the real Freighter contract against the installed package and official docs
- [x] T5 Slice 1 RED: `wallet-port` contract + failing Freighter adapter tests
- [x] T6 Slice 1 GREEN: real `FreighterWallet` adapter over the injected API
- [x] T7 Slice 2: `stellar-sdk`/Horizon account retrieval behind `LedgerPort`
- [x] T8 #75: prove the Feature's two invariants — the SDK split and the absence of a key path
- [ ] T9 #76: evidence document in Spanish, traceable to this log

## RED → GREEN

### Slice 1 — Freighter wallet adapter (`apps/web`)
- **RED** — 2026-09-20 17:09, `pnpm --filter @vaqcrow/web exec vitest run
  src/infrastructure/wallet/freighter-wallet.test.ts`. **12 failed / 12**, every failure
  `Error: not implemented` raised from the stub. The suite was written to encode the port contract
  (classification, explicit passphrase, network check, recovery) before any of it existed.
- **GREEN** — 17:10, same command. **12 passed / 12** after implementing `FreighterWallet` over the
  injected API. No test was weakened to get there.
- **Regression surfaced by the full gate** — 17:10, `pnpm run verify`. `workspace-status.test.tsx`
  failed: the component exercised the *real* adapter, which now talks to a browser extension. Not a
  stale expectation — the failure exposed a real defect (A2).
- **Root-cause fix + GREEN** — 17:11, `pnpm --filter @vaqcrow/web test`. **328 passed / 328**
  (326 before; +3 adapter cases, +1 component case, and one rewritten placeholder).
- **Full gate** — 17:12, `pnpm run verify`. lint, typecheck, test, build, `boundaries` (223 modules,
  519 dependencies, **0 violations**) and the 52 boundary-rule tests all pass.

### Slice 2 — Horizon account retrieval (`apps/api`)
- **RED** — 17:16, `pnpm --filter @vaqcrow/api exec vitest run
  src/infrastructure/adapters/stellar-amounts.test.ts
  src/infrastructure/adapters/stellar-ledger.test.ts`. **8 failed / 15**, every ledger failure
  `ledger.getAccount is not a function`. The port contract (envelope outcomes, stroop integers,
  `not_found` as an expected state) existed before the adapter implementing it did.
- **GREEN, first attempt — 2 failures that mattered.** Neither was a flaky test:
  - The SDK refuses a plain-HTTP Horizon URL, which would have made the loopback double #14
    explicitly admits impossible to construct (A3). Fixed in the adapter.
  - One of the assertions I wrote was simply wrong: `Number("9223372036854775807") ===
    9223372036854775807` is `true`, because the numeric literal is already rounded to the same
    double. Rewritten to compare `BigInt(Number(...))` with the exact value, which is what actually
    demonstrates the precision loss the helper exists to prevent.
- **GREEN** — 17:17, same command. **15 passed / 15**.
- **Full gate** — 17:18, `pnpm run verify` → **exit 0**. api **10 files / 178 tests** (was 8 / 163),
  `boundaries` clean at **227 modules / 529 dependencies**. The single ESLint warning in
  `fetch-http-client.ts` is pre-existing and untouched here.

### #75 — the Feature's invariants (`tests/`)
The Task's criteria are that deterministic tests demonstrate the Feature's core behaviour, that
validation/rejection/fallback are covered, and that the suite passes without live services. #74
already carried the adapter-level behaviour, so recon looked for what was still *unproven* — and
found two of the Feature's invariants had no test at all:

- **The SDK split was not machine-enforced.** `stellar-blockchain-requirements.md` Parte 4 §2 states
  that `@stellar/stellar-sdk` must not exist in the frontend and `@stellar/freighter-api` must not
  exist in the backend. `.dependency-cruiser.cjs` had **no rule for either**, so the split rested
  entirely on convention.
- **"No private key path exists" had no test.** It is #23's first acceptance criterion and its
  strongest claim.

- **RED** — `pnpm run test:boundaries`. **2 failed / 57**: both "flags a runtime …" cases reported
  `expected 0 to be greater than or equal to 1` — the fixtures imported the SDKs across the split and
  nothing forbade it. The two type-only cases passed vacuously and the anti-vacuity case passed,
  which is what proved both SDKs really do resolve from the real `apps/*/src`.
- **GREEN** — same command after adding `web-never-imports-server-stellar-sdk` and
  `api-never-imports-wallet-sdk`: **57 passed / 57**, and `pnpm run boundaries` stayed clean on the
  real source (227 modules, 529 dependencies, 0 violations).
- **The non-custody scanner: RED by construction.** A text scan was written first and immediately
  proved useless — it flagged `redaction.ts`'s own sensitive-key pattern and the wallet adapter's own
  documentation saying it never asks for a seed. Rewritten over the TypeScript AST, which cannot see
  comments or regex literals. Its *precision* is asserted rather than assumed: `Keypair.fromPublicKey`
  must stay legal (the funding-intent work verifies signatures against public keys) and prose naming
  these keys must not flag.
- **Coverage completion.** Three branches the implementation had added defensively had no test: the
  availability probe raising, an access grant carrying no address, and Horizon returning an account
  without a native balance. The last two pin the *non*-recoverable side of the contract, which is as
  much a part of "rejection is recoverable" as the recoverable side.
- **Full gate** — 17:56, `pnpm run verify` → **exit 0**. api **180**, web **330**, root **65** (was
  52), contracts 101, domain 60; boundaries clean at 227 modules / 529 dependencies.

## Advisories
- **A1 — `workspace-status.tsx` shows one generic failure state.** A declined request and a missing
  extension are indistinguishable in the UI today. The adapter classifies them; wiring that into
  differentiated copy is deferred to the journey Feature (#30). Not a criterion failure.
- **A2 — `requestAccess()` has no timeout, so the shell used to hang.** Found while fixing the
  regression above. `@stellar/freighter-api` sets a 2 s timeout only for `isConnected` and
  `getPublicKey`; `requestAccess` resolves *only* when the extension replies. Called with no
  extension installed, it never settles, so `connect()` left the button reading "connecting"
  forever. The adapter now probes availability first, which converts a missing wallet into an
  ordinary recoverable `unavailable` failure. This is product behaviour, not a test concern —
  DEMO.md's "Freighter no disponible" fallback depended on it. Recorded here rather than fixed
  silently because it was not in the Task's stated scope.
- **A3 — the SDK refuses a plain-HTTP Horizon URL by default.** `new Horizon.Server("http://…")`
  throws `Cannot connect to insecure horizon server` unless `allowHttp: true` is passed. #14 admits
  a **loopback** Horizon over HTTP precisely so a local double can stand in for Testnet, so without
  the flag the sanctioned local setup would have been impossible to construct — the guard in #14 and
  the guard in the SDK disagreed. The adapter now derives `allowHttp` from the URL scheme, and only
  a scheme #14 already validated can reach it. Found only because a test built the real client
  instead of a double.
- **A4 — the passphrase the browser will send to Freighter has no source yet.** `WalletPort.signTransaction`
  requires it, and nothing calls the port: the funding-intent Feature (#24) decides whether the web
  app learns it from the backend response or from its own configuration. The invariant that matters
  is now pinned — the API's declared Testnet passphrase is asserted equal to the SDK's
  `Networks.TESTNET` — but the seam between the two workspaces is #24's to close, not this Task's.
- **A5 — the bounded Testnet check in #23's testing strategy has still not been run.** #74's
  definition-of-ready requires Freighter installed on Testnet with a funded disposable account, and
  #23's strategy pairs the deterministic suite with "a bounded Testnet check". No live check was
  performed here, and #76 must either record one or state plainly that the check is a bounded
  external limitation — not imply it happened.
- **A6 — `tests/**` still gets no static analysis.** No root `tsconfig.json`, and turbo only walks
  workspaces, so the new scanner and its fixtures are untypechecked. This is the gap tracked by
  [#189](https://github.com/reyduar/Vaqcrow/issues/189); the files say so in their own headers.

## Review size and delivery chain

`#74` is larger than one review, so it is delivered as two stacked branches with no tracker branch
(the #44 precedent):

| Slice | Branch | Base | Commits | Size |
|---|---|---|---|---|
| 1 — web | `Vaqcrow#74_Task_Implement_Stellar_and_Freighter_integration` | `main` | `bee07a5`, `95ae734`, `a3c0d2b` | 557 hand-written lines + 181 generated lockfile |
| 2 — api | `…-02-api-horizon` | slice 1 | `d63390b` + the log commit | 364 lines |

No file is touched by both slices, so the second diff is additive on the first and review stays
scoped to one workspace at a time.

## Delivery
- **Slice 1** — PR [#191](https://github.com/reyduar/Vaqcrow/pull/191) → `main`, labels `type:task` +
  `area:stellar`. CI run `35534904962` **green** on the first attempt: *Quality gates (lint, types,
  tests, build, boundaries)*, *Playwright (deterministic, local double)*, and the Vercel deployment.
- **Slice 2** — PR [#192](https://github.com/reyduar/Vaqcrow/pull/192), stacked on slice 1, labels
  `type:task` + `area:stellar`. CI run `35535173609` **green**: *Quality gates*, *Playwright*, Vercel.
- **Neither PR closes #74.** Following the #44 chain (`PR #184`, "completes #44 when the chain lands
  on `main`"), the Task is closed manually once both slices are on `main` — a child PR merging into
  its parent branch is not the same event as the work reaching the default branch, and the record
  should not claim otherwise.
- **#74 landed.** Both merges are on `main`, in chain order: `72dc211` (slice 2 into its parent
  branch) then `418bb20` (slice 1 into `main`). Verified by ancestry, not by report — all seven
  commits are ancestors of `origin/main`. #74's three acceptance criteria were ticked and the Task
  closed as completed, naming both PRs and this log as its evidence.
- **#75** — PR [#193](https://github.com/reyduar/Vaqcrow/pull/193) → `main`, labels `type:task` +
  `area:stellar` + `area:testing`, four commits: `20e4509` (SDK split), `14ea664` (non-custody),
  `c9dc5c3` (branch coverage), `7cadc53` (this log). CI run `35537237212` **green**: *Quality gates*,
  *Playwright*, Vercel.

