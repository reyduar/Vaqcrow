import type { ReactElement } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DemoStepSlug } from "@/application/navigation/demo-steps";
import { demoSteps } from "@/application/navigation/demo-steps";
import { disclosures, microcopy } from "@/application/trust/disclosures";
import { panaderiaHorizonte, SIMULADO_LABEL } from "@/application/fixtures/panaderia-horizonte";
import { RouteHarness } from "@/test/route-harness";
import DemoLayout from "./layout";
import RequestPage from "./request/page";
import AiAssessmentPage from "./ai-assessment/page";
import ApprovalPage from "./approval/page";
import FundingPage from "./funding/page";
import DistributionPage from "./distribution/page";
import EvidencePage from "./evidence/page";

/**
 * Cross-route trust disclosure integration test (Feature #17 / Task #54).
 *
 * A LOCAL route→page map, deliberately NOT shared with
 * `layout.traversal.test.tsx` or `prohibited-terms.test.tsx` (product
 * decision: no cross-file coupling for this concern). Renders each real
 * route through the real `DemoLayout`/`DemoShell` shell (via `RouteHarness`,
 * following the same mocking pattern as `layout.traversal.test.tsx`) and
 * asserts that the persistent DEMO/TESTNET header chrome and each route's
 * required canonical disclosure text co-exist in one render. Every asserted
 * string is imported from `disclosures`/`microcopy`/the fixture module —
 * never hand-retyped — so this test cannot silently drift from the
 * canonical copy it verifies.
 */
vi.mock("next/navigation", async () => ({
  usePathname: (await import("@/test/route-harness")).useHarnessPathname,
  // The funding page keeps its campaign id in `?campaign=`; these routes
  // render with no query and never navigate.
  useRouter: () => ({ replace: () => undefined }),
  useSearchParams: () => new URLSearchParams()
}));
vi.mock("next/link", async () => ({
  default: (await import("@/test/route-harness")).HarnessLink
}));

const pageBySlug: Record<DemoStepSlug, ReactElement> = {
  request: <RequestPage />,
  "ai-assessment": <AiAssessmentPage />,
  approval: <ApprovalPage />,
  funding: <FundingPage />,
  distribution: <DistributionPage />,
  evidence: <EvidencePage />
};

/**
 * Required canonical text(s)/microcopy per route, per spec obs #445's
 * table. Every value is a reference into `disclosures`/`microcopy` — this
 * file never inlines the Spanish copy itself.
 */
const requiredTextsBySlug: Readonly<Record<DemoStepSlug, readonly string[]>> = {
  request: [disclosures.simulation.text],
  "ai-assessment": [disclosures["human-ai"].text, microcopy.humanDecision, microcopy.aiFallback],
  approval: [microcopy.humanDecision],
  funding: [
    disclosures.testnet.text,
    disclosures["non-custody"].text,
    disclosures["contract-custody"].text,
    microcopy.testAssetNoValue,
    microcopy.preSignCheck
  ],
  distribution: [disclosures.testnet.text, microcopy.submittedNotConfirmed],
  evidence: [
    disclosures.simulation.text,
    disclosures.testnet.text,
    disclosures["non-custody"].text,
    disclosures["contract-custody"].text,
    disclosures["no-production"].text,
    microcopy.deterministicCalculation,
    microcopy.priorRunHash
  ]
};

function renderDemoRoute(slug: DemoStepSlug) {
  return render(
    <RouteHarness initialPathname={`/${slug}`}>
      <DemoLayout>{pageBySlug[slug]}</DemoLayout>
    </RouteHarness>
  );
}

/** Finds the SIMULADO badge co-located with a given synthetic value's text, inside its `SyntheticValue` wrapper. */
function simuladoBadgeNear(valueText: string) {
  const valueNode = screen.getByText(valueText);
  const wrapper = valueNode.closest<HTMLElement>("span.inline-flex");
  if (!wrapper) {
    throw new Error(`No wrapping span found for value "${valueText}"`);
  }
  return within(wrapper).getByText(SIMULADO_LABEL);
}

describe("Cross-route trust disclosure integration", () => {
  it.each(demoSteps)(
    "renders DEMO/TESTNET header chrome together with the required disclosures for the $slug route",
    ({ slug }) => {
      renderDemoRoute(slug);

      expect(screen.getByText("DEMO")).toBeInTheDocument();
      expect(screen.getByText(microcopy.testnetBadge)).toBeInTheDocument();

      for (const text of requiredTextsBySlug[slug]) {
        expect(screen.getByText(text)).toBeInTheDocument();
      }
    }
  );

  it("renders request's Empresa/KYC synthetic values and sales table rows each with a SIMULADO badge, co-present with the DEMO/TESTNET header badges", () => {
    renderDemoRoute("request");

    expect(screen.getByText("DEMO")).toBeInTheDocument();
    expect(screen.getByText(microcopy.testnetBadge)).toBeInTheDocument();

    expect(simuladoBadgeNear(panaderiaHorizonte.legalName)).toHaveAttribute("data-variant", "simulado");
    expect(simuladoBadgeNear(panaderiaHorizonte.kyc.status)).toHaveAttribute("data-variant", "simulado");

    const reportedOrAnomalousRowCount = panaderiaHorizonte.sales.filter(
      (period) => period.status !== "missing"
    ).length;

    // One badge per non-missing sales row, counted inside the table now that the
    // request form and evidence review add their own SIMULADO labels to the route.
    expect(within(screen.getByRole("table")).getAllByText(SIMULADO_LABEL)).toHaveLength(
      reportedOrAnomalousRowCount
    );
  });
});
