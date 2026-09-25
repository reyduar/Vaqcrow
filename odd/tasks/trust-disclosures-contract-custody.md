# Trust disclosures reconciled with contract custody (#240)

Iteration log for Feature [#240](https://github.com/reyduar/Vaqcrow/issues/240) and its Tasks:
[#258](https://github.com/reyduar/Vaqcrow/issues/258) (rewrite), [#259](https://github.com/reyduar/Vaqcrow/issues/259) (test),
[#260](https://github.com/reyduar/Vaqcrow/issues/260) (evidence).

## Objective

State, in the demo's trust disclosures, where custody actually sits during a campaign: the
contributions are held by the Soroban vault contract, not by any person. Add the honest limits the
demo previously did not have to state — the destination is fixed and immutable, there is no
recovery and no clawback, and the deadline refund is permissionless but never self-firing — while
keeping every disclosure that remains true and every simulation label accurate.

## Problem

`apps/web/src/application/trust/disclosures.ts` pinned five canonical texts quoted verbatim from
`docs/planning/DEMO.md` §12 and `docs/design/demo-ui.md` §2. None of them mentioned the contract that
now holds the funds. The custody reality lived only in `DEMO.md` §7. A funding screen that renders
"Firma no custodial" and a pre-sign checklist naming `destino, activo, monto y memo` still framed
the step as a direct payment, which it stopped being when the vault landed (#247/#248).

## Why

Leaving the old copy in place would make the demo claim more than it proves: it would imply the
person custodies the money during the campaign and that a payment-like review is what they sign.
The Feature's whole point is that the copy must not outrun the contract.

## Scope

In:

- New canonical disclosure `contract-custody`, registered in all three canonical sources
  (`disclosures.ts`, `DEMO.md` §12, `demo-ui.md` §2) and rendered where the user meets the custody
  decision and the refund path (`funding`, `evidence`).
- The funding step's direct-payment pre-sign checklist reconciled to a contract invocation.
- `demo-ui.md` disclosure surfaces kept in lockstep with `DEMO.md` §12.

Out (explicit boundary):

- `DEMO.md` §3 (vertical history) and `demo-ui.md` §8 "Contenido clave" still describe the retired
  classic funding intent. The issue scopes `DEMO.md` to "the disclosure blocks" and demo-ui.md to
  its disclosure sections; rewriting the screen narrative is a separate change. Recorded as a
  finding in the evidence document rather than silently softened.
- No change to `non-custody` (keys/seed statement), `testnet`, `simulation`, `human-ai` or
  `no-production`: all five remain true verbatim.

## Constraints

- Copy in Spanish, matching the existing UI copy.
- No claim about legality, custody quality, profitability or provider quality; never call the
  contract audited or production-ready.
- `prohibited-terms.test.tsx` bans `Inversión segura`, `rentabilidad garantizada`, `Aprobado por IA`,
  `Dinero depositado`, `KYC verificado`, `Wallet de Vaqcrow`, `Pago real`, and any "retorno + certeza"
  phrasing.
- `disclosures.test.ts` pins the canonical texts byte-for-byte; changing copy and its pinned test is
  one atomic unit.

## TDD mode

`strict_tdd: true` (per `sdd-init/vaqcrow`). Runner: `pnpm --filter @vaqcrow/web test` (`vitest run`).

## Acceptance criteria (from #240)

- [ ] Every disclosure that described a direct payment is reconciled with contract custody
- [ ] The custody-during-campaign nuance is stated explicitly, not left implied
- [ ] The no-recovery and no-clawback limits are stated
- [ ] No disclosure claims a guarantee the contract does not provide
- [ ] Simulation labels remain accurate

## Route declaration

Substantial authorized implementation. Single writer thread on the Feature branch; each Task is one
work-unit commit. Exploration was delegated (read-only) because understanding required 4+ files;
reads that prepare a write stay with the writer. No SDD route selected.

## Tasks

### #258 — Rewrite the trust disclosures for contract custody
- [x] T1 — RED: pin the new canonical text/id and the reconciled per-route placement in tests
- [x] T2 — GREEN: add `contract-custody` to `disclosures.ts`; reconcile `preSignCheck`
- [x] T3 — Register `contract-custody` in `funding` + `evidence` (`step-disclosures.ts`)
- [x] T4 — `DEMO.md` §12 + `demo-ui.md` §1/§2/§8/§11 updated together
- [x] T5 — Focused tests green; commit

### #259 — Test the reconciled trust disclosures
- [x] T6 — RED: route render assertions for the custody statement and the limits
- [x] T7 — RED: semantic phrase pin (custody, immutable, no recovery, no clawback, sweep, permissionless)
- [x] T8 — GREEN: assertions pass; claim-by-claim review performed
- [x] T9 — Simulation labels asserted; commit

### #260 — Document evidence for the reconciled trust disclosures
- [ ] T10 — `docs/planning/trust-disclosures-and-contract-custody-evidence.md` (Spanish)
- [ ] T11 — Mapeo de criterios de aceptación + claim-by-claim review + findings
- [ ] T12 — Commit

## Progress

- 2026-09-25 — Feature branch `Vaqcrow#240_Feat_Reconcile_trust_disclosures_with_contract_custody`
  created off `main` (`27661f5`). Dependency #236 closed (100%); #240 unblocked. TDD mode resolved
  (`strict_tdd: true`). Iteration log created before the first source write.
- 2026-09-25 — #258 RED observed: 6 failed / 451 passed. Then GREEN.
- 2026-09-25 — Decision: `preSignCheck` is reconciled in place, not renamed. Its only consumer is the
  funding step, which is now the contract vault, so the funding pre-sign checklist must describe a
  contract invocation, not a payment. No dead key is left behind.
- 2026-09-25 — Decision: `contract-custody` uses the `simulation` banner variant, keeping `testnet`
  as the exclusive banner for the Stellar Testnet disclosure.
- 2026-09-25 — Verified the canonical text is byte-identical across `disclosures.ts`, `DEMO.md` §12,
  `demo-ui.md` §2 and `demo-ui.md` §11 (normalized only for markdown bold/quote markers).
- 2026-09-25 — #259 sensitivity proved by mutation: dropping the "no se dispara solo" statement from
  the copy failed exactly `contract-custody disclosure > states that the refund is not self-firing`
  and `FundingPage > renders the custody statement and its honest limits where the user meets
  custody and the refund path`; restored from HEAD, 57/57 green.
- 2026-09-25 — Claim-by-claim review performed against `contracts/campaign-vault/src/lib.rs`.
  One nuance considered and backed: "nadie tiene una clave para moverlos" covers a person holding a
  discretionary key; the investor's pre-goal `withdraw` and the contract's own payout are the
  contract's rules, not a key. Findings F1–F5 recorded in the evidence document (#260).

## Verification evidence

| Unit | Command | Result |
| --- | --- | --- |
| #258 RED | `pnpm --filter @vaqcrow/web test` | 6 failed / 451 passed — exactly the changed assertions |
| #258 GREEN | `pnpm --filter @vaqcrow/web exec vitest run trust "app/(demo)/funding" "app/(demo)/evidence"` | 7 files / 39 tests passed |
| #258 GREEN | `pnpm --filter @vaqcrow/web test` | 73 files / 465 tests passed |
| #258 | `pnpm --filter @vaqcrow/web typecheck` | clean |
| #258 | `pnpm --filter @vaqcrow/web lint` | 0 errors (1 pre-existing warning in `fetch-http-client.ts`, unrelated) |
| #259 guard | `pnpm --filter @vaqcrow/web exec vitest run trust "app/(demo)/funding" "app/(demo)/evidence"` | 8 files / 57 tests passed |
| #259 mutation | same command, copy with "no se dispara solo" removed | exactly 2 failures, both the new assertions; restored, green |

## Next step

T10: write the Spanish evidence document under `docs/planning/`.
