import type { ReactElement } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DemoStep } from "@/application/navigation/demo-steps";
import { demoSteps } from "@/application/navigation/demo-steps";
import { RouteHarness } from "@/test/route-harness";
import DemoLayout from "./layout";
import RequestPage from "./request/page";
import AiAssessmentPage from "./ai-assessment/page";
import ApprovalPage from "./approval/page";
import FundingPage from "./funding/page";
import DistributionPage from "./distribution/page";
import EvidencePage from "./evidence/page";

// `vi.mock` factories hoist above local declarations, so the harness is
// imported lazily inside each factory (design D1/D2) rather than referenced
// from the top-level import above (which is only usable after hoisting).
vi.mock("next/navigation", async () => ({
  usePathname: (await import("@/test/route-harness")).useHarnessPathname
}));
vi.mock("next/link", async () => ({
  default: (await import("@/test/route-harness")).HarnessLink
}));

const pageBySlug: Record<string, ReactElement> = {
  request: <RequestPage />,
  "ai-assessment": <AiAssessmentPage />,
  approval: <ApprovalPage />,
  funding: <FundingPage />,
  distribution: <DistributionPage />,
  evidence: <EvidencePage />
};

function renderDemoAt(initialSlug: string) {
  return render(
    <RouteHarness initialPathname={`/${initialSlug}`}>
      <DemoLayout>{pageBySlug[initialSlug]}</DemoLayout>
    </RouteHarness>
  );
}

/** Asserts the shell chrome (heading, position text, aria-current) for one step. */
function expectStepChrome(position: number, label: string) {
  expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
  expect(screen.getByText(`Step ${position} of 6: ${label}`)).toBeInTheDocument();
  expect(screen.getByText(`Step ${position} of 6: ${label}`).closest("[aria-current]")).toHaveAttribute(
    "aria-current",
    "step"
  );
}

function stepNav() {
  return screen.getByRole("navigation", { name: "Demo step navigation" });
}

/** Clicks the step-nav link that leads to `label`, driving the harness's real navigation. */
function clickStepLink(label: string) {
  fireEvent.click(within(stepNav()).getByRole("link", { name: label }));
}

const lastIndex = demoSteps.length - 1;

/** Bounds-checked step lookup — `demoSteps` indexing is `DemoStep | undefined` under strict mode. */
function stepAt(index: number): DemoStep {
  const step = demoSteps[index];
  if (!step) {
    throw new Error(`No demo step at index ${index}`);
  }
  return step;
}

describe("DemoLayout traversal (harness-driven)", () => {
  it("forward traversal through all six steps", () => {
    renderDemoAt(stepAt(0).slug);
    expectStepChrome(1, stepAt(0).label);

    for (let index = 1; index <= lastIndex; index += 1) {
      clickStepLink(stepAt(index).label);
      expectStepChrome(index + 1, stepAt(index).label);

      if (index < lastIndex) {
        expect(within(stepNav()).getByRole("link", { name: stepAt(index + 1).label })).toBeInTheDocument();
      }
    }

    expect(within(stepNav()).queryByRole("link", { name: stepAt(lastIndex).label })).not.toBeInTheDocument();
  });

  it("backward traversal through all six steps", () => {
    renderDemoAt(stepAt(lastIndex).slug);
    expectStepChrome(lastIndex + 1, stepAt(lastIndex).label);

    for (let index = lastIndex - 1; index >= 0; index -= 1) {
      clickStepLink(stepAt(index).label);
      expectStepChrome(index + 1, stepAt(index).label);

      if (index > 0) {
        expect(within(stepNav()).getByRole("link", { name: stepAt(index - 1).label })).toBeInTheDocument();
      }
    }

    expect(within(stepNav()).queryByRole("link", { name: stepAt(0).label })).not.toBeInTheDocument();
  });

  it("omits the previous link at step 1 and the next link at step 6, after real navigation", () => {
    renderDemoAt(stepAt(0).slug);

    expect(stepNav().querySelectorAll("a")).toHaveLength(1);

    for (let index = 1; index <= lastIndex; index += 1) {
      clickStepLink(stepAt(index).label);
    }

    expectStepChrome(lastIndex + 1, stepAt(lastIndex).label);
    expect(stepNav().querySelectorAll("a")).toHaveLength(1);
    expect(within(stepNav()).getByRole("link", { name: stepAt(lastIndex - 1).label })).toBeInTheDocument();
  });
});
