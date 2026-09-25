import { describe, expect, it } from "vitest";
import { disclosures, microcopy } from "./disclosures";

/**
 * Independently-pinned semantic guard for the contract-custody disclosure
 * (Feature #240 / Task #259).
 *
 * Every statement below is HAND-COPIED from the Feature's functional
 * requirements and cross-checked against `contracts/campaign-vault/src/lib.rs`
 * — it is never derived from `disclosures` itself, which would make the
 * assertion circular. The check is containment, not equality: the copy may
 * grow, but it may not silently drop a statement the contract's behaviour
 * depends on. A claim the contract cannot back is the exact failure this
 * Feature exists to prevent.
 */
const REQUIRED_STATEMENTS: Array<[string, RegExp]> = [
  ["custody sits with the contract, not a person", /los aportes los custodia el contrato, no una persona/i],
  ["nobody holds a key to those funds", /nadie tiene una clave para moverlos/i],
  [
    "the contract cannot be made to pay anyone but the fixed destination",
    /sólo puede pagar al destino fijo/i
  ],
  ["the destination is immutable once the vault exists", /ese destino es inmutable/i],
  ["the goal condition is enforced by the contract", /la meta la evalúa el contrato/i],
  [
    "settlement is atomic with the contribution that crosses the goal",
    /liquida a la PyME en la misma transacción/i
  ],
  ["there is no recovery mechanism", /no hay recuperación/i],
  ["there is no clawback", /ni clawback/i],
  ["unclaimed funds can only leave through the sweep", /sólo pueden salir por el barrido/i],
  ["unclaimed funds may otherwise stay in the contract", /pueden quedarse en el contrato/i],
  ["the deadline refund requires a transaction to be sent", /exige que alguien envíe la transacción/i],
  ["the refund is permissionless", /permissionless/i],
  ["the refund is not self-firing", /no se dispara solo/i]
];

describe("contract-custody disclosure", () => {
  const text = disclosures["contract-custody"].text;

  it.each(REQUIRED_STATEMENTS)("states that %s", (_statement, pattern) => {
    expect(text).toMatch(pattern);
  });

  it("never calls the contract audited or production-ready", () => {
    expect(text).not.toMatch(/auditad/i);
    expect(text).not.toMatch(/producción/i);
    expect(text).not.toMatch(/listo para/i);
  });

  it("never makes a claim about legality, solvency, returns or provider quality", () => {
    expect(text).not.toMatch(/legalidad/i);
    expect(text).not.toMatch(/solvencia/i);
    expect(text).not.toMatch(/garantiz/i);
    expect(text).not.toMatch(/rentabilidad/i);
    expect(text).not.toMatch(/asegur/i);
    expect(text).not.toMatch(/retorno/i);
    expect(text).not.toMatch(/proveedor(es)? de calidad/i);
  });

  it("pins the simulation labels that travel with the demo as independently-checked values", () => {
    expect(disclosures["contract-custody"].banner).toBe("simulation");
    expect(microcopy.testnetBadge).toBe("TESTNET · Activos sin valor económico");
    expect(microcopy.testAssetNoValue).toBe("Activo de prueba sin valor económico");
  });
});
