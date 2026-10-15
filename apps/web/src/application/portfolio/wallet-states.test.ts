import { describe, expect, it } from "vitest";
import {
  EMPTY_PORTFOLIO_COPY,
  PORTFOLIO_WALLET_COPY,
  TESTNET_LABORATORY_URL,
  walletConnectErrorMessage
} from "./wallet-states";

describe("PORTFOLIO_WALLET_COPY", () => {
  it("uses the exact connect CTA the template writes", () => {
    expect(PORTFOLIO_WALLET_COPY.connectCta).toBe("Conectar Freighter");
  });

  it("points the Testnet-funds guide at Stellar Laboratory", () => {
    // The Friendbot URL now comes from the shared `friendbotUrl(publicKey)` rule
    // (`@/application/company/funding`), so it is never a bare base URL (#544).
    expect(TESTNET_LABORATORY_URL).toBe("https://laboratory.stellar.org");
  });

  it("carries the unfunded warning and the funded note as separate strings", () => {
    expect(PORTFOLIO_WALLET_COPY.fundsUnfundedWarning).toMatch(/todavía no tiene XLM de Testnet/i);
    expect(PORTFOLIO_WALLET_COPY.fundsFundedNote).toMatch(/ya tiene XLM de Testnet/i);
  });

  it("explains that Friendbot funds a Testnet account with its public address, never the private key", () => {
    expect(PORTFOLIO_WALLET_COPY.fundsFriendbotHelp).toMatch(/dirección pública/i);
    expect(PORTFOLIO_WALLET_COPY.fundsFriendbotHelp).toMatch(/nunca con la clave privada/i);
  });

  it("keeps the Friendbot label the template writes", () => {
    expect(PORTFOLIO_WALLET_COPY.friendbotLabel).toBe("Pedir XLM de prueba (Friendbot)");
  });

  it("keeps the honest Testnet framing in the funding copy", () => {
    const text = Object.values(PORTFOLIO_WALLET_COPY).join(" ").toLowerCase();
    expect(text).toContain("sin valor económico");
    expect(text).toContain("no custodia");
    expect(text).not.toContain("rendimiento");
    expect(text).not.toContain("ganancia");
    expect(text).not.toContain("retorno");
  });
});

describe("EMPTY_PORTFOLIO_COPY", () => {
  it("labels the empty-portfolio CTA exactly «Explorar PyMEs»", () => {
    expect(EMPTY_PORTFOLIO_COPY.cta).toBe("Explorar PyMEs");
  });

  it("never promises a return (Testnet honesty)", () => {
    const text = `${EMPTY_PORTFOLIO_COPY.title} ${EMPTY_PORTFOLIO_COPY.body}`.toLowerCase();
    expect(text).not.toContain("rendimiento");
    expect(text).not.toContain("ganancia");
    expect(text).not.toContain("retorno");
  });
});

describe("walletConnectErrorMessage", () => {
  it("reuses the not-installed copy when Freighter is unavailable", () => {
    expect(walletConnectErrorMessage({ ok: false, stage: "wallet", code: "unavailable" })).toContain(
      "No encontramos Freighter"
    );
  });

  it("reuses the wrong-network copy", () => {
    expect(walletConnectErrorMessage({ ok: false, stage: "wallet", code: "network_mismatch" })).toBe(
      "Freighter está en otra red. Cambiá a Stellar Testnet para continuar."
    );
  });

  it("reuses the rejected copy", () => {
    expect(walletConnectErrorMessage({ ok: false, stage: "signature", code: "rejected" })).toBe(
      "Cancelaste la conexión en Freighter. Podés intentarlo de nuevo."
    );
  });

  it("reuses the persistence copy at the store stage, distinct from the wallet's", () => {
    expect(walletConnectErrorMessage({ ok: false, stage: "store", code: "unavailable" })).toBe(
      "No pudimos guardar tu wallet. Revisá tu conexión y probá de nuevo."
    );
  });

  it("reuses the invalid-session copy at the challenge stage", () => {
    expect(walletConnectErrorMessage({ ok: false, stage: "challenge", code: "unauthorized" })).toBe(
      "Tu sesión no es válida o venció. Volvé a iniciar sesión."
    );
  });
});
