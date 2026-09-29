# Implement Testnet revenue-share distribution

Iteration log for issue #89 (Task under Feature #28), branch
`Vaqcrow#89_Task_Implement_Testnet_revenue_share_distribution`, base `8b34d57`.

## Objective

Let the SME review and sign a Testnet revenue-share distribution with Freighter, have the backend verify the
signed XDR, submit it asynchronously, and retain the hash, recipients and amounts — reusing the
repository's existing non-custodial classic-payment pattern instead of a parallel stack.

## Problem

Feature #28 requires the non-custodial distribution transaction. Today the repo has a complete classic
prepare → sign → submit → confirm path for a **single** funding payment
(`apps/api/src/infrastructure/adapters/stellar-funding-intent-xdr.ts`, `…/stellar-transaction.ts`,
`…/stellar-horizon.ts`), the revenue-share engine (#27) emits `allocations[]` in minor units, and the
web has `FreighterWallet` and a `TransactionReviewModal`. What does not exist is a **multi-recipient**
builder/verifier, a distribution entity with recipients and amounts, its HTTP surface, or the web flow.

## Why

`docs/planning/DEMO.md` steps 9–10 and §5: the obligation is computed deterministically by the engine and
the SME signs a classic Testnet distribution; the AI never calculates or moves funds. Distribution is its
own vertical step, so it gets its own entity and route rather than overloading the funding-intent one.

## Scope

In: distribution wire contracts; the N-payment XDR build/verify adapter; prepare/submit/get use cases; the
distribution repository port and Supabase adapter; the HTTP route and wiring; the web gateway and
workspace replacing the `/distribution` placeholder.

Out: Feature #28's test Task (#90) and evidence Task (#91); the Soroban vault path; any change to the
revenue-share engine; real investor-account provisioning.

## Design decisions

- **D1 — Recipients are `{ accountId, amountStroops }`.** The engine's `contributorId` is an opaque
  domain string, not a Stellar key. The distribution names actual destinations; the caller maps its
  allocation to `(accountId, amountStroops)` before prepare. Optional `contributorId` travels for
  traceability only and is never a transaction field.
- **D2 — N native payments, one transaction.** The distribution is a single classic transaction with one
  `Operation.payment` per recipient (native XLM), built and re-verified order-sensitively against the
  declared recipient list, mirroring the funding-intent single-payment discipline (network passphrase,
  source, sequence, memo, `maxTime`, at-least-one-source signature, no fee-bump).
- **D3 — Own entity, not the funding-intent table.** A `revenue_share_distribution` record with immutable
  recipient child rows, keyed on `transaction_hash`, conditional state transitions, same sanitized-error
  and idempotency contract as funding intents.
- **D4 — Prepare stays stateless.** Nothing is persisted until a verified submission (same as #24);
  the signed envelope is re-verified against the declared terms because the server has no other record.
- **D5 — Async confirmation reuses the existing port and scheduler.** `StellarTransactionPort` and
  `ConfirmationScheduler` are reused; the confirmation loop is generalised over a structural record/repo
  shape rather than duplicated.

## Stable checklist (slices)

- [ ] S1 — Distribution contracts (`packages/contracts/src/revenue-share-distribution.ts`, id) + tests + barrel.
- [ ] S2 — Backend core: XDR port + N-payment adapter; prepare/submit/get use cases; repository port +
      Supabase adapter; migration; HTTP route; wiring; tests.
- [ ] S3 — Web: gateway + `distribution` workspace/page reusing `FreighterWallet` and the review modal; tests.
- [ ] S4 — Focused checks + `pnpm run verify`; RDD for each work unit; docs and Engram mirror.

## Constraints

- Strict TDD. `apps/api/src/application/**` stays provider-SDK-free; the web never imports the server SDK;
  `apps/api` never imports the wallet SDK; contracts stay Node-free and Fastify-free.
- Money is `bigint`; wire amounts are decimal strings.
- PR-gated tests never touch Testnet/Horizon/Freighter live; doubles and real-signed fixtures only.
- No secrets, seeds, PII, or unsupported production claims.
- Delivery strategy: `ask-on-risk` for this Feature.

## Forecast

Roughly 3 slices, each around or above the 400-line review budget; total well above it. The delivery
strategy is decided with the maintainer before the first commit.

## Route declaration

- S1/S2/S3 — delegated direct: one bounded writer per slice (multi-file, past the writer trigger), with the
  mapper handoff and the decisions above attached; skills resolved by registry name (Stellar dApp/data
  for S2–S3).
- Checks, RDD and commits — parent.

## Current next step

Confirm the delivery strategy with the maintainer, then start S1 (contracts).
