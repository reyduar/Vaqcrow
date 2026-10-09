import { describe, expect, it } from "vitest";
import {
  EMPTY_PORTFOLIO_COPY,
  PORTFOLIO_WALLET_COPY,
  TESTNET_FRIENDBOT_URL,
  TESTNET_LABORATORY_URL,
  walletConnectErrorMessage
} from "./wallet-states";

describe("PORTFOLIO_WALLET_COPY", () => {
  it("uses the exact connect CTA the template writes", () => {
    expect(PORTFOLIO_WALLET_COPY.connectCta).toBe("Conectar Freighter");
  });

  it("points the Testnet-funds guide at Friendbot and Stellar Laboratory", () => {
    expect(TESTNET_FRIENDBOT_URL).toBe("https://friendbot.stellar.org");
    expect(TESTNET_LABORATORY_URL).toBe("https://laboratory.stellar.org");
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
