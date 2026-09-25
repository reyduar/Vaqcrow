# Hosted vault configuration closure (#287) and the Testnet journey proof

Iteration log for closing issue #287 ("Enable the campaign-vault configuration on the hosted API")
and for producing the Testnet evidence that issue #249 needs.

Branch: `Vaqcrow#287_Task_Enable_the_campaign-vault_configuration_on_the_hosted_API`

## Objective

Make the hosted demo path actually run end to end against Testnet, so that:

1. #287's two remaining acceptance criteria close — the platform signing key is proven to match the
   deployed factory's `owner` (`POST /campaigns` exercised), and the storage/rotation decision is
   recorded.
2. #249 can be written from a real run: the three campaign states, the contribution hash, and the
   permissionless refund path.

## Problem

The hosted demo journey cannot start. Two independent facts, both verified in the code:

- The `/request` form posts to `POST /sme-requests`, a route that does not exist in `apps/api`
  (`apps/web/src/infrastructure/sme/http-sme-request-gateway.ts` declares itself a placeholder). The
  first step of the demo creates nothing.
- Nothing creates the `application_review` row the approval step needs.
  `ApplicationReviewRepositoryPort.create`/`transition` have zero production call sites; production
  only calls `findById` and `recordHumanDecision`. `apps/web/e2e-live/support/db.ts` states the same
  and works around it by seeding the row with `docker exec` against the **local** Supabase
  container — an approach with no hosted equivalent.

The approval form is hard-wired to the frozen fixture id
`5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f` (`apps/web/src/application/fixtures/demo-application.ts`).
In the hosted project that row does not exist, so the decision returns `404`, no application reaches
`approved`, and `POST /campaigns` rejects with `409`.

This is a **missing bootstrap step**, not a hidden defect. The `/request` placeholder is already an
acceptance criterion of #286. The bootstrap below replaces the local-only `docker exec` workaround
with a reproducible, idempotent statement the hosted profile can also run.

## Established state (verified, not assumed)

| Fact | Evidence |
| --- | --- |
| The hosted API is healthy with the vault enabled | `GET /health` → `{"status":"ok"}`. With only one of the two keys `parseApiConfig` throws and the process never starts, so a 200 proves both are present and shape-valid (`campaign-vault-config.ts`) |
| The campaign routes are registered on the host | `GET /campaigns/<uuid>` answers with the domain error shape, not Fastify's route-not-found |
| The platform account is funded | `GBCOTYYE3KGV745LQ4MELTP4IK2Z2RX2OESRNWP2LY6XLEI73X3PX2ZG` holds 9,969.07 XLM on Testnet (Horizon, 2026-09-23) |
| Nothing of value exists in the cloud project to lose | 0 rows in all six tables, `auth.users` 0, `storage.objects` 0 |
| The platform key cannot be rotated in place | `contracts/campaign-factory/src/lib.rs`: `owner` is written once in `__constructor`; there is no `set_owner`/`set_admin`/`transfer_admin`/`upgrade`/`migrate`. The full public surface is `__constructor`, `deploy`, `predict`, `owner`, `vault_wasm` |

## Tasks

- [x] **T1 — Track the work.** This document, on this branch, before the first write.
- [x] **T2 — Reproducible bootstrap for the hosted profile.** An idempotent statement that creates the
      demo application in the state the product's own flow would have produced (`human_review`), so
      approval and vault opening can happen through the real UI. Versioned in the repository so #249
      can cite the command.
- [x] **T3 — Apply the bootstrap to the hosted project** and verify the row, stating the observed
      result.
- [x] **T4 — Record the storage/rotation decision** (#287 criterion). Grounded in the verified
      immutability of the factory `owner`.
- [ ] **T5 — Exercise the hosted journey on Testnet.** Approval, then `POST /campaigns`, then verify
      the vault exists on the chain and that the mirror row was written.
- [ ] **T6 — Contribution through the interface**, capturing the transaction hash and the three
      states (`Funding`, `Settled`, `Refunding`).
- [ ] **T7 — Refund path**, including a trigger by someone other than the investor.
- [ ] **T8 — Update the cloud evidence doc** with both closed #287 criteria, stating each verification
      result's source.
- [ ] **T9 — Write `docs/planning/campaign-vault-web-journey-evidence.md`** for #249, in Spanish,
      mapping every acceptance criterion of #237 quoted verbatim.
- [x] **T10 — Operator-facing walkthrough guide.** A step-by-step guide, in Spanish, for setting up
      Freighter with both roles (PyME and investor), funding them on Testnet, and walking the six
      demo steps. Requested by the operator; it is what makes the hosted demo usable by someone
      other than the person who built it.

## Constraints

- Never write, print or record the value of any secret. Only key names and shapes.
- The identity `vaqcrow-testnet` must not be regenerated: it is the immutable `owner` of the deployed
  factory, and discarding it orphans that factory permanently.
- No test gated by pull request may depend on Testnet.
- Do not touch `docs/planning/demo-tasks-list.md` in this work.
- Do not report a merged state that does not exist yet.

## Progress

### T1 — done

Branch created off `main` (`69d8794`).

### T2 — done

`supabase/seed/demo-application.sql`. Idempotent (`on conflict (application_id) do nothing`), and it
creates the row in `human_review` rather than `approved`: that is the state the product's own
assessment flow would have produced, so `record_human_decision` is exercised as designed instead of
skipped. Seeding `approved` directly — the local test suite's shortcut — would bypass the step the
demo exists to show.

### T3 — done

Applied to the hosted project (`ppvlnwejajxpsmazvnbj`) through the Supabase MCP. Observed result:

```
[{"application_id":"5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f",
  "state":"human_review",
  "last_correlation_id":"00000000-0000-4000-8000-000000000287",
  "created_at":"2026-09-25 13:43:32.308584+00"}]
```

### T4 — done

Recorded in `docs/planning/cloud-environment-configuration-evidence.md` §5.1, with the #287 criterion
row moved from **No** to **Sí**. Grounded in two verified facts: the factory `owner` is written once
in `__constructor` with no setter and no upgrade path, and `deploy` authorizes only that stored
address — so rotation is a factory redeploy plus a re-pointed `STELLAR_CAMPAIGN_FACTORY_ID`, not an
in-place key swap.

### T10 — done

`docs/guides/freighter-and-testnet-walkthrough.md`. Written from the Stellar Foundation's official
Testnet guide plus what this repository and the deployed interface actually do, so the two roles are
not confused:

- Both accounts, their creation and their funding are covered, including the fact that the PyME does
  **not** need funds to open the vault (the platform creates and funds it) while the investor does.
- The state labels and button names are taken from `campaign-workspace.tsx`, not paraphrased, so the
  guide and the screen agree.
- The honest limits are stated: Testnet with no economic value, the simulated identity/KYC/sales, the
  two placeholder steps, and the fact that a refund is permissionless but still needs someone to
  send a transaction.
- **Corrected while being executed.** The first version claimed the second account gets its own
  recovery phrase. It does not: Freighter derives it from the existing phrase at another derivation
  index. The error surfaced when the operator tried to follow the guide — which is the whole point of
  a walkthrough. §5 now states the real behaviour and the consequence (one phrase controls both
  accounts), and points at the two ways to get genuinely independent identities (a separate browser
  profile, or adding an account by secret key).

### Decision not taken

The journey's vault is **1:1 with its application** (`campaign.application_id`), so opening it is a
one-shot action that leaves permanent Testnet state. It is therefore *not* exercised as a throwaway
pre-flight. The risk is bounded without one: if the platform key were not the factory's `owner`, the
deploy would fail with no state created at all, so the first real attempt is also the cheapest one.

## Next step

T5. Requires the operator's Testnet identity, because the SME account used by the vault is the
connected wallet's public key (`campaign-workspace.tsx`), and the contribution signature is produced
by Freighter in the browser.

