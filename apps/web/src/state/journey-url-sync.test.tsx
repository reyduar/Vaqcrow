import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JourneyStoreProvider, useJourneyStore } from "./journey-store-provider";
import { JourneyUrlSync } from "./journey-url-sync";

const APP = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";
const CAMPAIGN = "40000000-0000-4000-8000-000000000000";
const OTHER_APP = "9a8b7c6d-1111-4222-8333-444455556666";

const { usePathname, useSearchParams, replace } = vi.hoisted(() => ({
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
  replace: vi.fn()
}));

vi.mock("next/navigation", () => ({ usePathname, useSearchParams, useRouter: () => ({ replace }) }));

/** Drives the store the way the steps do: through its public actions. */
function Actions() {
  const recordApplication = useJourneyStore((s) => s.recordApplication);
  const recordCampaign = useJourneyStore((s) => s.recordCampaign);
  return (
    <>
      <button onClick={() => recordApplication(APP)}>record application</button>
      <button onClick={() => recordCampaign(CAMPAIGN)}>record campaign</button>
    </>
  );
}

function Probe() {
  const applicationId = useJourneyStore((s) => s.applicationId);
  const campaignId = useJourneyStore((s) => s.campaignId);
  return <p data-testid="probe">{`${applicationId}|${campaignId}`}</p>;
}

function tree(initial = {}) {
  return (
    <JourneyStoreProvider initial={initial}>
      <Actions />
      <Probe />
      <JourneyUrlSync />
    </JourneyStoreProvider>
  );
}

/** Simulates a navigation: the router now reports other search params. */
function navigate(view: ReturnType<typeof render>, query: string, initial = {}) {
  useSearchParams.mockReturnValue(new URLSearchParams(query));
  view.rerender(tree(initial));
}

function mount(query: string, initial = {}) {
  useSearchParams.mockReturnValue(new URLSearchParams(query));
  return render(
    <JourneyStoreProvider initial={initial}>
      <Actions />
      <JourneyUrlSync />
    </JourneyStoreProvider>
  );
}

describe("JourneyUrlSync", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/request");
    replace.mockReset();
  });

  it("does nothing when the URL already matches the store", () => {
    mount(`application=${APP}`, { applicationId: APP });
    expect(replace).not.toHaveBeenCalled();
  });

  it("writes an id recorded in the store into the current URL, keeping other params", () => {
    mount("foo=bar");
    fireEvent.click(screen.getByRole("button", { name: "record application" }));
    expect(replace).toHaveBeenLastCalledWith(`/request?foo=bar&application=${APP}`);
  });

  it("writes downstream ids too", () => {
    mount(`application=${APP}`, { applicationId: APP });
    fireEvent.click(screen.getByRole("button", { name: "record campaign" }));
    expect(replace).toHaveBeenLastCalledWith(`/request?application=${APP}&campaign=${CAMPAIGN}`);
  });

  it("scrubs a journey param the store does not hold", () => {
    mount("application=nope");
    expect(replace).toHaveBeenLastCalledWith("/request");
  });

  describe("URL -> store when navigation changes the params", () => {
    it("follows a navigation to another valid application and does not rewrite the URL back", () => {
      useSearchParams.mockReturnValue(new URLSearchParams(`application=${APP}&campaign=${CAMPAIGN}`));
      const view = render(tree({ applicationId: APP, campaignId: CAMPAIGN }));
      navigate(view, `application=${OTHER_APP}`);
      expect(screen.getByTestId("probe")).toHaveTextContent(`${OTHER_APP}|null`);
      expect(replace).not.toHaveBeenCalled();
    });

    it("scrubs invalid incoming ids once, with the existing rules", () => {
      useSearchParams.mockReturnValue(new URLSearchParams(`application=${APP}`));
      const view = render(tree({ applicationId: APP }));
      navigate(view, `application=${OTHER_APP}&campaign=nope`);
      expect(screen.getByTestId("probe")).toHaveTextContent(`${OTHER_APP}|null`);
      expect(replace).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenLastCalledWith(`/request?application=${OTHER_APP}`);
    });
  });

  describe("store -> URL only after a local write", () => {
    it("replaces once per local write and treats the echo of its own write as no navigation", () => {
      useSearchParams.mockReturnValue(new URLSearchParams());
      const view = render(tree());
      fireEvent.click(screen.getByRole("button", { name: "record application" }));
      expect(replace).toHaveBeenCalledTimes(1);
      navigate(view, `application=${APP}`);
      expect(screen.getByTestId("probe")).toHaveTextContent(`${APP}|null`);
      expect(replace).toHaveBeenCalledTimes(1);
    });

    it("keeps a newer local write when the echo of an older one arrives late", () => {
      useSearchParams.mockReturnValue(new URLSearchParams(`application=${APP}`));
      const view = render(tree({ applicationId: APP }));
      fireEvent.click(screen.getByRole("button", { name: "record campaign" }));
      fireEvent.click(screen.getByRole("button", { name: "record application" }));
      // the router finally reports the first write's URL
      navigate(view, `application=${APP}&campaign=${CAMPAIGN}`);
      expect(screen.getByTestId("probe")).toHaveTextContent(`${APP}|${CAMPAIGN}`);
    });
  });
});
