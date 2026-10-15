// Probe regression tests — issue #531 (AC1/AC2/AC3).
// Authored by the independent verifier; committed by the orchestrator.
// Target: apps/web/src/__probe__/issue531-funding.test.tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompanyTestnetFunds } from "@/presentation/components/company/company-testnet-funds";
import { fundingState, friendbotUrl, MIN_TESTNET_XLM } from "@/application/company/funding";
import { CompanyWorkspace } from "@/presentation/components/pyme-onboarding/company-workspace";
import { FakeKyc } from "@/test/fake-kyc";
import { FakeWallet, FakeWalletBalance, FakeWalletConnection } from "@/test/fake-wallet";
import type { MyCampaignsPort } from "@/application/ports/my-campaigns-port";

const KEY = "GBXK1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ2345677Q2M";
const guide = (): HTMLElement =>
  screen.getByRole("region", { name: "Guía para fondear tu wallet de Testnet" });
const okMyCampaigns = (): MyCampaignsPort => ({ get: async () => ({ ok: true, myCampaigns: { campaigns: [] } }) });

describe("AC1 — Friendbot is never a primary action", () => {
  const states = [
    { publicKey: null, balanceXlm: null }, // disconnected
    { publicKey: KEY, balanceXlm: "12.5000000" }, // connected + funded
    { publicKey: KEY, balanceXlm: "0.0000000" } // connected + unfunded
  ] as const;

  for (const props of states) {
    it(`no Friendbot button/label/accent-anchor (${JSON.stringify(props)})`, () => {
      render(<CompanyTestnetFunds {...props} onConnect={() => {}} />);
      expect(screen.queryByRole("button", { name: /friendbot/i })).toBeNull();
      expect(screen.queryByText("Fondear con Friendbot")).toBeNull();
      for (const a of Array.from(document.querySelectorAll("a"))) {
        if (/friendbot/i.test(a.getAttribute("href") ?? "")) {
          expect(a.className).not.toMatch(/bg-brand-accent|text-on-accent/);
          expect(a.className).toMatch(/bg-transparent/);
        }
      }
    });
  }

  it("disconnected and funded render no Friendbot anchor; only primary is connect", () => {
    render(<CompanyTestnetFunds publicKey={null} balanceXlm={null} onConnect={() => {}} />);
    expect(document.querySelector('a[href*="friendbot"]')).toBeNull();
    const primary = Array.from(document.querySelectorAll("a,button")).filter((e) => /bg-brand-accent/.test(e.className));
    expect(primary).toHaveLength(1);
    expect(primary[0]!.textContent).toContain("Conectar Freighter");
  });
});

describe("AC2 — honest balance + funding statement", () => {
  it("funded shows balance + can-pay, no warning", () => {
    render(<CompanyTestnetFunds publicKey={KEY} balanceXlm="12.5000000" />);
    expect(screen.getByText("12,5000000 XLM")).toBeTruthy();
    expect(screen.getByText(/ya tiene XLM de Testnet para pagar/i)).toBeTruthy();
    expect(screen.queryByText(/todavía no tiene XLM/i)).toBeNull();
  });
  it("unfunded shows balance + warning, no funded claim", () => {
    render(<CompanyTestnetFunds publicKey={KEY} balanceXlm="0.0000000" />);
    expect(screen.getByText(/todavía no tiene XLM de Testnet/i)).toBeTruthy();
    expect(screen.queryByText(/ya tiene XLM de Testnet para pagar/i)).toBeNull();
  });
  it("connected with unknown balance never fabricates a number", () => {
    render(<CompanyTestnetFunds publicKey={KEY} balanceXlm={null} />);
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText(/todavía no tiene XLM de Testnet/i)).toBeTruthy();
  });
});

describe("AC3 — connect action, busy honesty, sanitized failure", () => {
  it("busy is disabled + aria-busy; idle enabled", () => {
    const { unmount } = render(<CompanyTestnetFunds publicKey={null} onConnect={() => {}} connecting />);
    const busy = screen.getByRole("button", { name: /Conectando/ });
    expect(busy).toBeDisabled();
    expect(busy.getAttribute("aria-busy")).toBe("true");
    unmount();
    render(<CompanyTestnetFunds publicKey={null} onConnect={() => {}} />);
    expect(screen.getByRole("button", { name: "Conectar Freighter" })).toBeEnabled();
  });
  it("workspace failure shows only mapped copy, never a provider string, and no faked card", async () => {
    render(
      <CompanyWorkspace
        kyc={new FakeKyc()}
        walletPort={new FakeWallet()}
        connection={new FakeWalletConnection()}
        balance={new FakeWalletBalance()}
        myCampaigns={okMyCampaigns()}
      />
    );
    fireEvent.click(within(guide()).getByRole("button", { name: "Conectar Freighter" }));
    const alert = await within(guide()).findByRole("alert");
    expect(alert.textContent).toContain("No encontramos Freighter en este navegador.");
    expect(alert.textContent).not.toMatch(/fake wallet failure|no wallet connected/i);
    expect(screen.queryByRole("region", { name: /Freighter conectada de forma no custodial/ })).toBeNull();
  });
});

describe("fundingState boundaries (own inputs)", () => {
  it("empty key is disconnected; minimum boundary is exact", () => {
    expect(fundingState("", "100")).toBe("disconnected");
    expect(fundingState(KEY, String(MIN_TESTNET_XLM))).toBe("funded");
    expect(fundingState(KEY, "0.9999999")).toBe("unfunded");
  });
  it("negative/whitespace/Infinity/NaN are never funded", () => {
    expect(fundingState(KEY, "-5")).toBe("unfunded");
    expect(fundingState(KEY, "   ")).toBe("unfunded");
    expect(fundingState(KEY, "Infinity")).toBe("unfunded");
    expect(fundingState(KEY, "NaN")).toBe("unfunded");
  });
  it("friendbotUrl percent-encodes reserved characters", () => {
    expect(friendbotUrl("G+A/B")).toBe("https://friendbot.stellar.org/?addr=G%2BA%2FB");
  });
});
