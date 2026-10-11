# Hosted end-to-end rehearsal

`hosted-rehearsal.mjs` drives the **complete role flow of the deployed Vaqcrow
stack at the API level** — the hosted Railway API
(`https://api-production-c07f.up.railway.app`), the remote Supabase project
(Auth + Storage + Postgres) and **Stellar Testnet** — with one run producing a
fresh PyME, application and vault. No browser, no doubles.

It mirrors the U9 live harness
(`apps/web/e2e-live/admin-review.live.spec.ts`) where the role UI has a control,
and calls the same real routes the product would for the steps with no UI (the
FX rate, the KYC document verdict, an investor's contribution). Signing happens
in-process with `@stellar/stellar-sdk`, exactly as the live harness signs through
its Freighter bridge — a Node script can sign directly.

## What it proves

| Step | Route |
| ---- | ----- |
| 0 | `POST /admin/rates` (v1 when the table is empty) |
| 1 | GoTrue `signup` → Admin API `email_confirm` → password grant |
| 2 | `POST /profile/wallet/challenge` + `/profile/wallet` (SEP-53 message) |
| 3 | `POST /businesses` |
| 4 | `POST /storage/uploads` × 3 documents + 1 photo (multipart) |
| 5 | `POST /completeness-check` (advisory: always `200`, warns only) |
| 6 | `POST /sme-requests` → `applicationId` |
| 7 | `GET /application-reviews/:id/context`, `PUT …/documents/:id/verdict`, `POST …/decisions` |
| 8 | `GET /application-reviews/:id/deployment` until `confirmed` → `campaignId` |
| 9 | `GET /campaigns/:id` → `contractAddress` |
| 10 | investor: GoTrue `signup`/`confirm`, Friendbot, wallet link |
| 11 | `POST /campaigns/:id/invocations` → sign XDR → `/invocations/submission` → observe tx |
| 12 | `GET /campaigns/:id` reflects the contribution |

Every step prints a short `[reh] step: …` line and the run ends with a `FACTS`
line carrying the public ids/hashes (application id, campaign id, contract
address, transaction hash) — **never** a secret, token or password.

## Prerequisites

- Node ≥ 24 (the repo pins it). Global `fetch`, `FormData` and `Blob` are used.
- The cloud profile at the repository root: `.env.cloud` with
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `VAQCROW_SUPERADMIN_EMAIL`,
  `VAQCROW_SUPERADMIN_PASSWORD`. The file is **never read or printed directly**
  — Node loads it with `--env-file` and this script only reads `process.env`.
- Outbound access to the hosted API, the Supabase project, Testnet Horizon and
  Friendbot.

Optional overrides: `HOSTED_API_BASE_URL`, `STELLAR_HORIZON_URL`,
`STELLAR_FRIENDBOT_URL`.

## Run

From `apps/api` (the API workspace resolves `@stellar/stellar-sdk`):

```bash
node --env-file=../../.env.cloud ../../scripts/demo/rehearsal/hosted-rehearsal.mjs
```

Or from the repository root (`--env-file` accepts an absolute or root-relative
path; the script resolves the SDK through the API workspace regardless of cwd):

```bash
node --env-file=.env.cloud scripts/demo/rehearsal/hosted-rehearsal.mjs
```

Exit code `0` means the journey reached the observed contribution; a non-zero
code prints `[reh] FAILED: <step> -> HTTP <status> <sanitized body>`.

## Honesty notes

- **Real Testnet, no economic value.** The remote Supabase project is written to;
  each run creates fresh records and nothing is reset (Option A).
- **Synthetic data only.** Documents and the photo are generated in-process
  (`syntheticPdf`/`syntheticPng`) and say so in their text; the CUIT is a
  well-formed synthetic value.
- The completeness check returning `complete:false` with `content_irrelevant`
  findings is **expected for synthetic documents** — the vision model judges
  them not to be real sales declarations / CUIT / estatuto. It is advisory and
  never blocks the send.
- The SME account is created by the platform during the deploy; the script's
  friendbot call skips it when it already exists (and funds the investor's
  account, which must exist to pay the contribution).

## A real gotcha (script bug, not a product one)

`Keypair.signMessage(message)` returns a **plain `Uint8Array`**, not a `Buffer`.
`signature.toString("base64")` on a `Uint8Array` ignores its argument and
returns a comma-separated byte list, which the API correctly rejects with
`400 { code: "invalid_request" }`. Wrap it: `Buffer.from(sig).toString("base64")`.
