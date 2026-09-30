import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useJourneyStore } from "@/state/journey-store-provider";
import DemoLayout from "./layout";

const APP = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";
const CAMPAIGN = "40000000-0000-4000-8000-000000000000";

const { usePathname, useSearchParams, replace } = vi.hoisted(() => ({
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
  replace: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname,
  useSearchParams,
  useRouter: () => ({ replace })
}));

/** Reads the journey store through the public hook, as every workspace does. */
function JourneyProbe() {
  const applicationId = useJourneyStore((state) => state.applicationId);
  const campaignId = useJourneyStore((state) => state.campaignId);
  const distributionId = useJourneyStore((state) => state.distributionId);
  return <p data-testid="probe">{`${applicationId}|${campaignId}|${distributionId}`}</p>;
}

describe("DemoLayout", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/request");
    useSearchParams.mockReturnValue(new URLSearchParams());
    replace.mockReset();
  });

  it("renders the demo shell chrome around its children for a valid demo route", () => {
    render(
      <DemoLayout>
        <p>Step body content</p>
      </DemoLayout>
    );

    expect(screen.getByRole("heading", { name: "Request" })).toBeInTheDocument();
    expect(screen.getByText("Step body content")).toBeInTheDocument();
  });

  it("mounts the journey store provider: a child can read it, empty without params", () => {
    render(
      <DemoLayout>
        <JourneyProbe />
      </DemoLayout>
    );

    expect(screen.getByTestId("probe")).toHaveTextContent("null|null|null");
  });

  it("hydrates the store from the search params", () => {
    useSearchParams.mockReturnValue(new URLSearchParams(`application=${APP}&campaign=${CAMPAIGN}`));

    render(
      <DemoLayout>
        <JourneyProbe />
      </DemoLayout>
    );

    expect(screen.getByTestId("probe")).toHaveTextContent(`${APP}|${CAMPAIGN}|null`);
  });

  it("ignores invalid and orphaned params instead of failing", () => {
    useSearchParams.mockReturnValue(new URLSearchParams(`application=nope&campaign=${CAMPAIGN}`));

    render(
      <DemoLayout>
        <JourneyProbe />
      </DemoLayout>
    );

    expect(screen.getByTestId("probe")).toHaveTextContent("null|null|null");
  });
});
