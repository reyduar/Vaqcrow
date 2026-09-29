import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { disclosures, microcopy } from "@/application/trust/disclosures";

const { get, workspace } = vi.hoisted(() => ({
  // `URLSearchParams.get` answers `null` for a missing key, so the default keeps
  // the page's "no id" branch truthful; individual tests answer per key.
  get: vi.fn<(key: string) => string | null>().mockReturnValue(null),
  // Captures the props the page hands to the workspace, so this suite proves the
  // page's own read of the URL without standing up the real workspace.
  workspace: {
    campaignId: undefined as string | null | undefined,
    distributionId: undefined as string | null | undefined
  }
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get })
}));

// The workspace's own behaviour has its own suite; the page's own wiring — the
// two ids it reads from `?campaign=` and `?distribution=` — is what these tests
// prove.
vi.mock("@/presentation/components/evidence-workspace", () => ({
  EvidenceWorkspace: (props: {
    readonly campaignId?: string | null;
    readonly distributionId?: string | null;
  }) => {
    workspace.campaignId = props.campaignId;
    workspace.distributionId = props.distributionId;
    // Render the ids the page handed down, as `/distribution` does, so the
    // wiring survives the route-level assertions too.
    return (
      <p>
        {`campaign:${props.campaignId ?? "sin referencia"} distribution:${props.distributionId ?? "sin referencia"}`}
      </p>
    );
  }
}));

import EvidencePage from "./page";

/**
 * Route-scoped disclosure assertions (Feature #17 / Task #54, spec obs #445)
 * plus the T92-04 replacement check: the placeholder is gone and the evidence
 * workspace now renders in its place. Asserts only this route's own content —
 * DEMO/TESTNET header chrome and cross-route co-presence are covered by
 * `trust-disclosures.integration.test.tsx`.
 *
 * T93-01 adds the page's own URL read: the two ids the journey carried must
 * reach the workspace unchanged, and a missing id must arrive as `null` (a
 * declared absence) rather than being swallowed.
 */
describe("EvidencePage", () => {
  afterEach(() => {
    get.mockReset();
    get.mockReturnValue(null);
    workspace.campaignId = undefined;
    workspace.distributionId = undefined;
  });

  it("renders the full simulation, testnet, non-custody, contract-custody, and no-production disclosure texts verbatim", () => {
    render(<EvidencePage />);

    expect(screen.getByText(disclosures.simulation.text)).toBeInTheDocument();
    expect(screen.getByText(disclosures.testnet.text)).toBeInTheDocument();
    expect(screen.getByText(disclosures["non-custody"].text)).toBeInTheDocument();
    expect(screen.getByText(disclosures["contract-custody"].text)).toBeInTheDocument();
    expect(screen.getByText(disclosures["no-production"].text)).toBeInTheDocument();
  });

  it("renders the custody statement and its honest limits on the panel that evidences refunds", () => {
    render(<EvidencePage />);

    expect(
      screen.getByText(/los aportes los custodia el contrato, no una persona/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/no hay recuperación ni clawback/i)).toBeInTheDocument();
    expect(screen.getByText(/sólo pueden salir por el barrido/i)).toBeInTheDocument();
  });

  it("renders the deterministic-calculation and prior-run-hash microcopy", () => {
    render(<EvidencePage />);

    expect(screen.getByText(microcopy.deterministicCalculation)).toBeInTheDocument();
    expect(screen.getByText(microcopy.priorRunHash)).toBeInTheDocument();
  });

  it("renders no step placeholder: this route carries its own content", () => {
    render(<EvidencePage />);

    expect(screen.queryByText(/Step content coming soon/i)).not.toBeInTheDocument();
  });

  it("reads ?campaign= and ?distribution= and hands both ids to the workspace", () => {
    const campaignId = "123e4567-e89b-42d3-a456-4266141740ab";
    const distributionId = "223e4567-e89b-42d3-a456-4266141740ab";
    get.mockImplementation((key) =>
      key === "campaign" ? campaignId : key === "distribution" ? distributionId : null
    );

    render(<EvidencePage />);

    expect(workspace.campaignId).toBe(campaignId);
    expect(workspace.distributionId).toBe(distributionId);
    // The page reads exactly the two keys the journey carries; any other read
    // would make it depend on a query key the URL contract does not define.
    expect(get.mock.calls.map(([key]) => key)).toEqual(["campaign", "distribution"]);
    expect(
      screen.getByText(`campaign:${campaignId} distribution:${distributionId}`)
    ).toBeInTheDocument();
  });

  it("hands the workspace null for both ids when neither is in the url", () => {
    render(<EvidencePage />);

    // A missing key is a declared absence, never coerced to an empty string that
    // a downstream reader could mistake for a supplied id.
    expect(workspace.campaignId).toBeNull();
    expect(workspace.distributionId).toBeNull();
    expect(workspace.campaignId).not.toBe("");
    expect(workspace.distributionId).not.toBe("");
    expect(
      screen.getByText("campaign:sin referencia distribution:sin referencia")
    ).toBeInTheDocument();
  });
});
