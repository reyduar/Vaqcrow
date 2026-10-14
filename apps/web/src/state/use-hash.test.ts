import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useHash } from "./use-hash";

/**
 * The URL's fragment as state (#514). jsdom does not fire `hashchange` on its own
 * when the hash is assigned, so the event is dispatched the way the browser would.
 */
describe("useHash", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("reads the current fragment and follows hashchange", () => {
    window.location.hash = "";
    const { result } = renderHook(() => useHash());
    expect(result.current).toBe("");

    act(() => {
      window.location.hash = "#como-funciona";
      window.dispatchEvent(new Event("hashchange"));
    });

    expect(result.current).toBe("#como-funciona");
  });
});
