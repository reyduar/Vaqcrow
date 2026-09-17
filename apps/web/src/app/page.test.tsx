import { describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect
}));

import Home from "./page";

describe("Home", () => {
  it("redirects to the first demo step", () => {
    Home();

    expect(redirect).toHaveBeenCalledWith("/request");
  });
});
