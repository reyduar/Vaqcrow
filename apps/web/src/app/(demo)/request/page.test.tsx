import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { disclosures } from "@/application/trust/disclosures";
import { panaderiaHorizonte, SIMULADO_LABEL } from "@/application/fixtures/panaderia-horizonte";
import RequestPage from "./page";

/**
 * Route-scoped disclosure assertions (Feature #17 / Task #54, spec obs #445).
 * Asserts only this route's own content — DEMO/TESTNET header chrome and
 * cross-route co-presence are covered by `trust-disclosures.integration.test.tsx`.
 */
describe("RequestPage", () => {
  it("renders the full simulation disclosure text verbatim", () => {
    render(<RequestPage />);

    expect(screen.getByText(disclosures.simulation.text)).toBeInTheDocument();
  });

  it("renders Empresa and KYC synthetic values each with an adjacent SIMULADO badge", () => {
    render(<RequestPage />);

    const legalNameNode = screen.getByText(panaderiaHorizonte.legalName);
    const legalNameWrapper = legalNameNode.closest<HTMLElement>("span.inline-flex");
    expect(legalNameWrapper).not.toBeNull();
    expect(within(legalNameWrapper!).getByText(SIMULADO_LABEL)).toBeInTheDocument();

    const kycNode = screen.getByText(panaderiaHorizonte.kyc.status);
    const kycWrapper = kycNode.closest<HTMLElement>("span.inline-flex");
    expect(kycWrapper).not.toBeNull();
    expect(within(kycWrapper!).getByText(SIMULADO_LABEL)).toBeInTheDocument();
  });

  it("renders sales evidence table rows with a SIMULADO badge on every reported/anomalous period and none on the missing one", () => {
    render(<RequestPage />);

    for (const period of panaderiaHorizonte.sales) {
      const row = screen.getByText(period.label).closest("tr");
      expect(row).not.toBeNull();

      if (period.status === "missing") {
        expect(within(row!).getByText("Dato faltante")).toBeInTheDocument();
        expect(within(row!).queryByText(SIMULADO_LABEL)).not.toBeInTheDocument();
      } else {
        expect(within(row!).getByText(SIMULADO_LABEL)).toBeInTheDocument();
      }
    }
  });
});
