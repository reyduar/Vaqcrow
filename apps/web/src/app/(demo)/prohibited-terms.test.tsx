import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AiAssessmentPage from "./ai-assessment/page";
import ApprovalPage from "./approval/page";
import DistributionPage from "./distribution/page";
import EvidencePage from "./evidence/page";
import FundingPage from "./funding/page";
import RequestPage from "./request/page";

/**
 * Guards `docs/design/demo-ui.md` §10.5 "Términos prohibidos o
 * condicionados" and the spec's "Prohibited/Conditioned Terms" requirement:
 * none of these phrases may render unqualified on any of the six demo
 * routes. Every route in this app composes copy exclusively from the
 * canonical `application/trust/disclosures.ts` module and its own frozen
 * fixture/microcopy, none of which contain these strings — this test is a
 * regression guard against a future route inlining ad hoc marketing copy.
 */
const PROHIBITED_PHRASES = [
  "Inversión segura",
  "rentabilidad garantizada",
  "Aprobado por IA",
  "Dinero depositado",
  "KYC verificado",
  "Wallet de Vaqcrow",
  "Pago real",
  "Retorno garantizado"
];

const pages = [
  ["request", RequestPage],
  ["ai-assessment", AiAssessmentPage],
  ["approval", ApprovalPage],
  ["funding", FundingPage],
  ["distribution", DistributionPage],
  ["evidence", EvidencePage]
] as const;

describe("Prohibited/conditioned terms", () => {
  it.each(pages)("route %s never renders a prohibited phrase unqualified", (_slug, Page) => {
    const { container } = render(<Page />);
    const text = container.textContent ?? "";

    for (const phrase of PROHIBITED_PHRASES) {
      expect(text).not.toContain(phrase);
    }
  });
});
