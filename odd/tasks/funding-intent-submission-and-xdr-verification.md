# Funding intent submission and XDR verification (issue #24)

## Objective
Deliver GitHub issue #24 — Feature "Build, verify and submit funding intent" — through its ordered
Tasks: #77 Implement → #78 Test → #79 Document evidence.

The Feature's three acceptance criteria are the real contract (verbatim from the issue; the Task
bodies are boilerplate):

1. **Altered XDR rejects** — after receiving the signed XDR, the backend re-validates it against the
   intent it built: same network, source, sequence, destination, asset, amount, memo, valid
   timebounds and an allowlist of permitted operations. A signature over anything else is refused
   before submission.
2. **duplicate submit is safe** — replaying the same submission returns the original outcome instead
   of applying it twice. Reusing the same key with a *different* payload is a conflict, not a replay.
3. **initial state is submitted.** — the persisted funding intent starts at `submitted`.

Task #77's functional requirement (verbatim): "Build a funding intent and XDR, then verify network,
source, destination, asset, amount, memo, sequence, timeout, allowed operations, and expected
signatures before submission."

## Constraints
- Node 24 (`>=24 <25`); pnpm 11.27.0 pinned. The system `node` is v26, so commands run with
  `PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"`.
- Code, tests, commits and PR bodies in English. Conventional commits, no AI attribution.
- Boundaries (`.dependency-cruiser.cjs`):
  - `api-application-stays-provider-free` — `apps/api/src/application/` may not **runtime**-import
    `@stellar/*`, `@supabase/*`, `fastify` or LLM SDKs (type-only allowed). All XDR build/decode/
    verify logic lives in `infrastructure/adapters/`, behind a port.
  - `web-never-imports-server-stellar-sdk` — `@stellar/stellar-sdk` must not appear in `apps/web`.
  - `web-presentation-stays-contracts-free` — components may not runtime-import `@vaqcrow/contracts`.
  - `api-never-imports-wallet-sdk` — `@stellar/freighter-api` must not appear in `apps/api`.
- `pnpm run verify` must stay free of Testnet, Horizon, Freighter and LLM providers.
- Task #77's testing strategy: RED → GREEN → REFACTOR.
- Money is integer-only (stroops). Never a float; reuse `xlmToStroops`.

## Shared gate — skills / MCP discovery
`skill_resolution: skill-registry`. No dependency is added by this Feature — `@stellar/stellar-sdk`
and `@stellar/freighter-api` are already installed and boundary-enforced — so the gate applies to
authoring skills only. Matched from `.atl/skill-registry.md` by technology:

- `dapp` — Stellar SDK transaction building/signing/verification and Freighter integration.
- `data` — Horizon querying and submission.
- `supabase` + `supabase-postgres-best-practices` — the `funding_intents` migration, RLS, grants and
  idempotent transitions.

No MCP server is required for authoring; recorded as `mcp_support: none`.

## Design decisions

- **D1 — Decision A: the API carries the network identity.** The prepare response returns the
  unsigned XDR together with `network`, `networkPassphrase` and `expiresAt`; the web never holds its
  own copy of the passphrase. Grounded in `product.md` §7 (`API-->>W: XDR + passphrase + expiración`)
  and its rule "Persistir red y `networkPassphrase`; nunca inferirlas de la interfaz". Option B (the
  web pinning its own constant) was rejected: `@stellar/stellar-sdk` is forbidden in `apps/web`, so it
  would need a hardcoded literal, and it would create a second source of truth that fails late.

- **D2 — Three endpoints.** `POST /funding-intents` builds and returns the unsigned XDR and
  **persists nothing**; `POST /funding-intents/:intentId/submission` receives the signed XDR,
  verifies it and persists the intent; `GET /funding-intents/:intentId` reports status. The prepare
  step is forced by D1 — the web cannot sign what it cannot receive — and keeping it stateless is
  what makes "initial state is submitted" true without inventing pre-submission states.

- **D3 — The persisted intent's initial state is `submitted`.** The longer machine in `product.md`
  §8.1 (`draft -> … -> awaiting_signature -> signed -> submitted -> confirmed`) is the production
  roadmap beyond the demo, which AGENTS.md states explicitly. `confirmed` and `failed` arrive with
  #25 (asynchronous confirmation). `DEMO.md` §7 corroborates: respond `202 Accepted` and show
  `submitted`, confirm later by polling.

- **D4 — Option 2 scope: the intent does not require an approved application.** Destination, amount
  and memo arrive in the request; the journey link (solicitud → IA → aprobación → fondeo) is #30's
  composition, per its own objective. The intent nevertheless carries a **nullable `application_id`
  with an FK to `application_review`** for traceability only — no `approved` state check and no
  amount cap in #24. The #29 dashboard shows decisions and funding together, which needs a
  correlation key; adding the column costs one line in a migration written anyway, while deferring it
  costs a later migration plus a contract change and loses the correlation of intents already
  created.

- **D5 — Idempotency is a body-carried UUID with an exact-keys guard.** Mirrors
  `decisionId`/`record_human_decision`: the command carries the id, the route rejects any body whose
  key set differs from the contract, and reuse with a different payload is an `idempotency_conflict`
  rather than a replay. This is a deliberate demo-scope deviation from `product.md` §8.1's
  `Idempotency-Key` header (production roadmap); the local precedent is deterministic, already proven
  and gives exactly the semantics criterion 2 needs.

- **D6 — XDR logic lives behind a port in `infrastructure/adapters/`.** `api-application-stays-provider-free`
  forbids the SDK in `application/`, so build and verify are exposed through a port the use case can
  call, exactly as `LedgerPort`/`StellarLedger` already do.

- **D7 — Verification uses the SDK's own primitives, not a re-implementation.**
  `TransactionBuilder.fromXDR(signedXdr, networkPassphrase)` to decode, then
  `Keypair.fromPublicKey(source).verify(tx.hash(), signature.signature)` over `tx.signatures`. The
  passphrase only determines the signature hash, so a signature produced for another network fails
  verification — the check is cryptographic, not a string comparison. `tests/stellar-non-custody.test.ts`
  already whitelists `Keypair.fromPublicKey` as legitimate #24 work.

- **D8 — A fee-bump envelope is refused.** `fromXDR` can return `Transaction | FeeBumpTransaction`;
  only the former is accepted, so the outer-fee indirection cannot be used to smuggle a different
  inner transaction past the allowlist.

- **D9 — the table CHECK pins acceptance criterion 3.** `check (state = 'submitted')` because
  `submitted` is the only state #24 can produce (D3). It turns "initial state is submitted" into a
  database-enforced fact rather than a convention only the application layer keeps. #25 widens the
  constraint in its own migration — deliberately, not by oversight.

- **D10 — `on delete set null`, not `on delete cascade`.** `human_decision` cascades because it is an
  audit row *of* its application. A funding record is financial evidence in its own right: deleting
  the application must not delete the evidence of a signed instruction to move money, only drop a
  link that no longer has a referent. Recorded because it deviates from the repo's cascade precedent.

- **D11 — the amount is constrained positive at the database.** `check (amount_stroops > 0)`: a zero
  or negative funding intent is not an instruction to move money. The contract (WU3) enforces the
  same invariant; this stops the database accepting what the API would refuse, which is the repo's
  established habit of mirroring contract invariants as CHECKs.

## Tasks
- [x] T1 Recon: #24/#77, roadmap entries, existing ports/adapters/routes, boundaries, skills
- [x] T2 Assign #24 and #77; move both to `In progress` on Project #4
- [x] T3 WU1 — XDR build + verify behind a port (`FundingIntentXdrPort` + `StellarFundingIntentXdr`)
      with focused unit tests — `b03048b`, `8b49649`
- [x] T4 WU2 — Persistence: `funding_intents` migration (RLS + explicit grants + trigger) and
      `SupabaseFundingIntentRepository`, with unit tests — `af95e55`, `89daba9`
- [ ] T5 WU3 — Contracts, use cases and HTTP surface (`create` / `submit` / `get`), wiring in
      `build-app.ts` and `index.ts`
- [ ] T6 WU4 — Web slice: gateway, state hook calling `WalletPort.signTransaction`, funding page
- [ ] T7 #78 — the ordered test Task: invariants and API integration coverage
- [ ] T8 #79 — evidence document in Spanish, traceable to this log

## RED → GREEN

### WU1 — XDR build + verify behind a port (`apps/api`)
- **RED** — `pnpm --filter @vaqcrow/api exec vitest run
  src/infrastructure/adapters/stellar-funding-intent-xdr.test.ts
  src/infrastructure/adapters/stellar-amounts.test.ts`. **1 file failed / 0 tests collected**:
  `Error: Cannot find module './stellar-funding-intent-xdr.js' imported from
  '.../stellar-funding-intent-xdr.test.ts'`. The suite was written to encode the port contract — the
  operation allowlist, every intent comparison and the signature check — before any of it existed.
- **GREEN** — same command. **42 passed / 42** (30 XDR + 12 amounts, the latter including 5 new
  `stroopsToXlm` cases). No test was weakened to get there.
- **One test helper corrected, not weakened.** `addSignature(publicKey, base64)` in
  `@stellar/stellar-sdk@17.1.0` *verifies against the current hash*, so it cannot attach a signature
  over a different hash — which is precisely what the criterion-1 proof needs.
  `addDecoratedSignature(signer.signDecorated(foreignHash))` is the primitive that can. Recorded
  because that difference is the entire point of the test.
- **A security invariant test had to be narrowed, and the narrowing was itself narrowed.** The new
  tests need an in-memory `Keypair.random()` signer, which `tests/stellar-non-custody.test.ts` flags
  by design. The first attempt excluded every `*.test.ts(x)` from the scan; that would have stopped
  detecting a hardcoded seed in a fixture, so it was replaced with an opt-in
  `allowEphemeralSigners` that suppresses **only** `Keypair.random`. Seed literals, secret-bearing
  identifiers and `fromSecret` stay flagged in test files, and two probe tests pin that precision.
  Commit `b03048b`.
- **Full gate** — `pnpm run verify` → **exit 0**. domain 60, contracts 101, api **215** (was 180),
  web 330, root **67** (was 65), `boundaries` clean at **231 modules / 538 dependencies**. The single
  ESLint warning is pre-existing in `apps/web/src/infrastructure/http/fetch-http-client.ts` and
  untouched here.

### WU2 — the `funding_intent` table and its repository (`supabase/`, `apps/api`)
- **RED** — `pnpm --filter @vaqcrow/api exec vitest run
  src/infrastructure/adapters/supabase-funding-intent-repository.test.ts`. **1 file failed / 0 tests
  collected**: `Cannot find module './supabase-funding-intent-repository.js'`. Same failure mode as
  WU1 — the suite encoded the port contract before the adapter existed.
- **GREEN** — same command. **22 passed / 22** after implementing the adapter over a hand-written
  fake supabase-js client (no live database). The insert-path assertions check the **exact payload
  sent**, not only the response — the lesson #41's review demanded.
- **The write path's central assumption was verified against the live database, not assumed.** The
  adapter sends `amount_stroops` as a decimal string because a JS `bigint` is not JSON-serializable
  and a JS `number` loses precision above 2^53. PostgREST's coercion was confirmed empirically with a
  read-only query on the real project:
  `json_to_record('{"a":"9223372036854775807"}') as t(a bigint)` returns the exact value, for both the
  string and the number form. Recorded because it was the one premise the implementation could not
  prove locally.
- **Three corrections the review surfaced.** (a) An empty memo could be written but never read back:
  the row decoder routed `memo` through a helper that rejects empty strings, so a stored `""` became
  `unavailable`. It now has its own nullable-text decoder, with a test. (b) A money column had no
  positivity constraint, unlike the repo's habit of mirroring contract invariants as CHECKs — D11
  adds `amount_stroops > 0`. (c) A test named "preserves an amount beyond `Number.MAX_SAFE_INTEGER`
  without precision loss" **overstated**: it fed the adapter a string, but the read path cannot
  round-trip such a value (advisory A2). Renamed to what it actually proves, and a case for the real
  hazard — an imprecise JSON number — was added.
- **Full gate** — `pnpm run verify` → **exit 0**. domain 60, contracts 101, api **239** (was 215),
  web 330, root **67**, `boundaries` clean at **234 modules / 548 dependencies**.

## Advisories

- **A1 — the built envelope carries `minTime` = build time.** `build` sets
  `timebounds: { minTime: now, maxTime: … }` rather than leaving `minTime` at 0. That bounds the
  intent from below, which is defensible for an instruction to move money, but Stellar rejects a
  transaction whose `minTime` is ahead of the ledger close time (`tx_too_early`). Testnet closes a
  ledger every ~5 s and the person signs within seconds, so the window is small. Recorded rather than
  changed because the submission path belongs to #25; worth revisiting if a demo transaction is ever
  rejected as too early.

- **A2 — a funding amount above 2^53 cannot be read back.** The **write** path is lossless: PostgREST
  coerces the decimal string the adapter sends into `bigint` (verified against the live database). The
  **read** path is not: PostgREST renders `bigint` as an *unquoted* JSON number —
  `row_to_json` returns `{"amount":9223372036854775807}` — so the client's `JSON.parse` has already
  rounded the value before the adapter sees it. The adapter's `Number.isSafeInteger` guard then
  rejects it as `unavailable` rather than truncating it silently, which is the right failure but
  still a failure. The demo's synthetic amounts are many orders of magnitude below the threshold, so
  this is a declared limit rather than a defect. If larger amounts ever matter, the fix is known: cast
  the column to text on read (the adapter already accepts a decimal string) and verify the cast
  against the live API. #78's integration test should confirm the boundary empirically.

## Review size and delivery chain
WU1 is three commits: `b03048b` (the scan allowance), `8b49649` (the XDR port, adapter, tests and
the `stroopsToXlm` helper) and `9c58489` (the WU1 log). WU2 adds `af95e55` (the migration) and
`89daba9` (the port, adapter and tests). `#77` is still forecast to exceed one review once the HTTP
work unit lands, so a stacked chain is likely; the split is decided when WU3 is planned.

## Delivery
_To be filled as PRs are opened._
