import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The funding page keeps its campaign id in `?campaign=` through the App
// Router; these renders have no router mounted and never navigate.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => undefined }),
  useSearchParams: () => new URLSearchParams()
}));
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
 *
 * §10.5's rows are mostly fixed literal phrases, but its last row —
 * "`Retorno` como certeza" — is a conceptual guideline, not a fixed
 * phrase: any wording that pairs "Retorno" with certainty-implying language
 * (e.g. "garantizado", "asegurado", "certeza", "sin riesgo", "100%") is
 * prohibited, not only the literal string "Retorno garantizado".
 * `RETORNO_AS_CERTAINTY_PATTERN` below catches that whole family instead of
 * one fixed phrase.
 */
const PROHIBITED_PHRASES = [
  "Inversión segura",
  "rentabilidad garantizada",
  "Aprobado por IA",
  "Dinero depositado",
  "KYC verificado",
  "Wallet de Vaqcrow",
  "Pago real"
];

/**
 * Matches "Retorno" (in either order, within the same sentence) paired with
 * certainty-implying language — the conceptual guideline from §10.5's last
 * row, not just the literal phrase "Retorno garantizado".
 */
const RETORNO_AS_CERTAINTY_PATTERN =
  /retorno[^.]{0,40}(garantiz\w*|asegur\w*|certeza|100\s?%|sin\s+riesgo)|(garantiz\w*|asegur\w*|certeza|100\s?%|sin\s+riesgo)[^.]{0,40}retorno/i;

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

    expect(text).not.toMatch(RETORNO_AS_CERTAINTY_PATTERN);
  });
});
