import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JourneyStoreProvider, useJourneyStore } from "./journey-store-provider";
import { JourneyUrlSync } from "./journey-url-sync";

const APP = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";
const CAMPAIGN = "40000000-0000-4000-8000-000000000000";

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
});
