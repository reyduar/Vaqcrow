# Real Testnet wallet balance (#557)

Objective: show the connected wallet's real Testnet XLM balance on `/company` and `/portfolio` instead of the simulated `0.0000000`. Branch `Vaqcrow#557_Feat_Read_the_real_Testnet_XLM_balance_from_Horizon_in_the_wallet_card`; delivery `single-pr`; runner `pnpm --filter @vaqcrow/web test` (Vitest), gate `pnpm run verify`. Epic #555.

## Specs

- **S1** — "A funded Testnet account shows its real balance on `/company` and `/portfolio`."
- **S2** — "An unfunded account shows `0` and the funding warning; after Friendbot, the balance updates and the warning clears without signing out."
- **S3** — "A Horizon error renders an unavailable state, not `0.0000000`."
- **S4** — "`pnpm run verify` passes with no network dependency."
- **S5** — "Docs that describe the balance as simulated are updated."
- Technical constraints quoted from the issue: "New `infrastructure/wallet/` adapter implementing `WalletBalancePort` over `fetch` against Horizon `GET /accounts/{id}`"; "A Horizon `404` maps to an unfunded account (`"0"`), not to an error; network/5xx map to the existing `unavailable`/`network` codes."; "The Horizon base URL defaults to `https://horizon-testnet.stellar.org`"; "PR-gated tests never hit Horizon (local doubles / stubbed `fetch`)."

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1, S2, S3, S4 | inline | open | — |
| T2 | S1, S2, S4 | inline | open | — |
| T3 | S5 | inline | open | — |

- T1 — `HorizonWalletBalanceAdapter` over `fetch` (native balance, 404 → `0.0000000`, 5xx → `unavailable`, thrown fetch → `network`, malformed body → `unavailable`).
- T2 — wire it as the production default in `company-workspace.tsx` and `portfolio.tsx`; re-read the balance when the user returns to the tab (Friendbot opens in a new tab); inject a double in every test that relied on the default.
- T3 — port/adapter docs, a dated note in `docs/planning/pyme-wallet-connection-evidence.md`, and the Feature's evidence document.

Route evidence: no Writer trigger (one sequential unit, no parallel disjoint units, far from the context backstop), so the parent writes inline.

## Log

- **L1** (2026-10-15, owner, verbatim): «dale, arrancá con #557». Source finding (issue #557, verbatim): «Cuando cree una wallet nueva en Freigther y me conecta a ella en la pagina de Mi Campaña/Mi Portafolio muestra la seccion de Fondear tu wallet con XLM de prueba, al pedir XLM de prueba con Friendbot resultado de "successful": true, y por ejemplo en este balance https://stellar.expert/explorer/testnet/account/GDPBT572AGQCVSRF2K6DSAZPEFOTMD3C3JZUKWMW3R2RSXRPSRNWFCDR me muestra saldo pero en la tarjeta no actualiza el saldo Saldo disponible muestra 0,0000000 XLM, osea no esta trayendo el valor actual del balance, incluso me sigue diciendo la tarjeta de Tu cuenta todavía no tiene XLM de Testnet: sin saldo no podés aportar ni cubrir las comisiones de la red.»
- **L2** — Root cause (verified): `company-workspace.tsx:154` and `portfolio.tsx:53` default to `SimulatedWalletBalanceAdapter`, which always returns `"0.0000000"` (#406/#407 T1c interim). The web has no Content-Security-Policy, so a browser `fetch` to Horizon is not blocked. `portfolio.test.tsx` renders `<Portfolio>` without a `balance` double, so it would hit the network once the default changes; it gets a double in T2.
- **L3** — Decision: no new `NEXT_PUBLIC_*` variable. The Horizon URL is the canonical Testnet default (settled decision: the canonical endpoints are defaults, not required variables), injectable through the adapter's constructor. Friendbot links open in a new tab (`target="_blank"`), so refreshing on `visibilitychange`/`focus` covers "after Friendbot … without signing out" without inventing an undesigned refresh button.
