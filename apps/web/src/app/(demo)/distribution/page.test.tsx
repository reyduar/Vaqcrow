import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { disclosures, microcopy } from "@/application/trust/disclosures";

const { replace, get, workspace } = vi.hoisted(() => ({
  replace: vi.fn(),
  get: vi.fn().mockReturnValue(null),
  // Captures the callback the page hands down, so this suite can drive the
  // handler the page itself owns without standing up the whole workspace.
  workspace: { onIdentified: undefined as ((distributionId: string) => void) | undefined }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => ({ get, toString: () => "" })
}));

// The workspace's own behaviour has its own suite; the page's own wiring — the
// `?distribution=` write — is what T92-03 adds and what these tests prove.
vi.mock("@/presentation/components/distribution-workspace", () => ({
  DistributionWorkspace: (props: {
    readonly distributionId?: string | null;
    readonly onDistributionIdentified?: (distributionId: string) => void;
  }) => {
    workspace.onIdentified = props.onDistributionIdentified;
    return <p>{props.distributionId ?? "sin referencia"}</p>;
  }
}));

import DistributionPage from "./page";

/**
 * Route-scoped disclosure assertions (Feature #17 / Task #54, spec obs #445)
 * plus the T92-03 URL-identity checks: the page reads `?distribution=`, shows
 * the id it read, and writes the id the workspace names back into the URL —
 * beside, never instead of, its disclosures.
 */
describe("DistributionPage", () => {
  it("renders the full testnet disclosure text verbatim", () => {
    render(<DistributionPage />);

    expect(screen.getByText(disclosures.testnet.text)).toBeInTheDocument();
  });

  it("renders the submitted-not-confirmed microcopy", () => {
    render(<DistributionPage />);

    expect(screen.getByText(microcopy.submittedNotConfirmed)).toBeInTheDocument();
  });

  it("shows the distribution id it read from ?distribution= without losing its disclosure content", () => {
    const distributionId = "123e4567-e89b-42d3-a456-4266141740ab";
    get.mockReturnValueOnce(distributionId);

    render(<DistributionPage />);

    expect(screen.getByText(distributionId)).toBeInTheDocument();
    expect(screen.getByText(disclosures.testnet.text)).toBeInTheDocument();
    expect(screen.getByText(microcopy.submittedNotConfirmed)).toBeInTheDocument();
  });

  it("writes the identified distribution id into ?distribution=", () => {
    const distributionId = "223e4567-e89b-42d3-a456-4266141740ab";
    render(<DistributionPage />);

    act(() => {
      workspace.onIdentified?.(distributionId);
    });

    expect(replace).toHaveBeenCalledWith(`?distribution=${distributionId}`);
    expect(screen.getByText(distributionId)).toBeInTheDocument();
  });
});
