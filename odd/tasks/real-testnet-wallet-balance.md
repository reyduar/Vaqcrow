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
| T1 | S1, S2, S3, S4 | inline | done | `c03912f`; RED (module missing) → GREEN 7/7 |
| T2 | S1, S2, S4 | inline | done | `def81f4`; RED 4 container tests → GREEN 41/41 |
| T3 | S5 | inline | done | `docs(planning): record the real Testnet wallet balance evidence (#557)` |

- T1 — `HorizonWalletBalanceAdapter` over `fetch` (native balance, 404 → `0.0000000`, 5xx → `unavailable`, thrown fetch → `network`, malformed body → `unavailable`).
- T2 — wire it as the production default in `company-workspace.tsx` and `portfolio.tsx`; re-read the balance when the user returns to the tab (Friendbot opens in a new tab); inject a double in every test that relied on the default.
- T3 — port/adapter docs, a dated note in `docs/planning/pyme-wallet-connection-evidence.md`, and the Feature's evidence document.

Route evidence: no Writer trigger (one sequential unit, no parallel disjoint units, far from the context backstop), so the parent writes inline.

## Log

- **L1** (2026-10-15, owner, verbatim): «dale, arrancá con #557». Source finding (issue #557, verbatim): «Cuando cree una wallet nueva en Freigther y me conecta a ella en la pagina de Mi Campaña/Mi Portafolio muestra la seccion de Fondear tu wallet con XLM de prueba, al pedir XLM de prueba con Friendbot resultado de "successful": true, y por ejemplo en este balance https://stellar.expert/explorer/testnet/account/GDPBT572AGQCVSRF2K6DSAZPEFOTMD3C3JZUKWMW3R2RSXRPSRNWFCDR me muestra saldo pero en la tarjeta no actualiza el saldo Saldo disponible muestra 0,0000000 XLM, osea no esta trayendo el valor actual del balance, incluso me sigue diciendo la tarjeta de Tu cuenta todavía no tiene XLM de Testnet: sin saldo no podés aportar ni cubrir las comisiones de la red.»
- **L2** — Root cause (verified): `company-workspace.tsx:154` and `portfolio.tsx:53` default to `SimulatedWalletBalanceAdapter`, which always returns `"0.0000000"` (#406/#407 T1c interim). The web has no Content-Security-Policy, so a browser `fetch` to Horizon is not blocked. A first grep suggested `portfolio.test.tsx` renders `<Portfolio>` without a `balance` double; a closer read showed every case injects `BALANCE` through props, and the page tests never reach a balance read (the default connection port finds no wallet in tests). T2 still stubs the Horizon module in both container test files as a guard.
- **L3** — Decision: no new `NEXT_PUBLIC_*` variable. The Horizon URL is the canonical Testnet default (settled decision: the canonical endpoints are defaults, not required variables), injectable through the adapter's constructor. Friendbot links open in a new tab (`target="_blank"`), so refreshing on `visibilitychange`/`focus` covers "after Friendbot … without signing out" without inventing an undesigned refresh button.
- **L4** — Decision: the adapter uses an injectable `AxiosInstance` (the web's HTTP-gateway idiom, `http-blog-gateway.ts`) instead of raw `fetch`. The issue's "over `fetch`" intent is "plain HTTP, not the SDK", and the boundary rule is still met.
- **L5** — T1 RED: `horizon-wallet-balance-adapter.test.ts` failed because the module was missing. GREEN: 7/7. Commit `c03912f`.
- **L6** — T2 RED: four new container tests (Horizon default + refresh on `visibilitychange`, in `company-workspace.test.tsx` and `portfolio.test.tsx`) failed on `777,0000000 XLM` / `10.000,0000000 XLM`. GREEN: 41/41. Both test files stub the Horizon module with `vi.mock`, so no test reaches the network. `SimulatedWalletBalanceAdapter` and its test were removed (no production users; the test double is `FakeWalletBalance`). `pnpm run verify` exit 0: web 252 files / 2495 tests, API 3179, boundaries clean (1396 modules). Commit `def81f4`.
- **L7** — Live read-only check against Testnet Horizon (2026-10-15): the reported account returned `200` with `native` `10000.0000000`; a random never-funded key returned `404`; Horizon echoes `Access-Control-Allow-Origin`.
- **L8** — Security (OWASP Top 10:2025; LLM 2026 not applicable, no AI): **no findings**. A05: the id is encoded (`horizon-wallet-balance-adapter.ts:36`). A08: the response is validated to a finite numeric string (`:58`) and an error renders «—», never zero. A10: every failure becomes a typed code (`:43`). No new dependency; fixed host.
- **L9** — Advisory (not fixed, pre-existing): with an unknown balance (Horizon down) the funds guide still shows the «sin saldo» warning, because `fundingState(null)` is `unfunded`, as pinned by `portfolio-wallet-funding.regression.test.tsx`. Not a regression from this Feature. Next: open the PR; the manual Friendbot walk-through on the hosted web is still pending.
