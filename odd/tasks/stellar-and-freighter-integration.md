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
- [ ] T7 Slice 2: `stellar-sdk`/Horizon account retrieval behind `LedgerPort`
- [ ] T8 #75: focused deterministic suite (Feature-level test Task)
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

## Review size and delivery chain
_(filled in when each slice is pushed)_

## Delivery
_(PR numbers, CI run ids, merge state)_
