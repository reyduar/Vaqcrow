import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDemoStep } from "./use-demo-step";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname
}));

describe("useDemoStep", () => {
  it("resolves the step, position, and total for a valid demo route", () => {
    usePathname.mockReturnValue("/ai-assessment");

    const { result } = renderHook(() => useDemoStep());

    expect(result.current).not.toBeNull();
    expect(result.current?.step.slug).toBe("ai-assessment");
    expect(result.current?.position).toBe(2);
    expect(result.current?.total).toBe(6);
  });

  it("resolves the step from a pathname with a trailing slash", () => {
    usePathname.mockReturnValue("/request/");

    const { result } = renderHook(() => useDemoStep());

    expect(result.current?.step.slug).toBe("request");
  });

  it("returns a null previous on the first step and the correct next step", () => {
    usePathname.mockReturnValue("/request");

    const { result } = renderHook(() => useDemoStep());

    expect(result.current?.previous).toBeNull();
    expect(result.current?.next?.slug).toBe("ai-assessment");
  });

  it("returns a null next on the last step and the correct previous step", () => {
    usePathname.mockReturnValue("/evidence");

    const { result } = renderHook(() => useDemoStep());

    expect(result.current?.next).toBeNull();
    expect(result.current?.previous?.slug).toBe("distribution");
  });

  it("returns null when the pathname is not a demo step route", () => {
    usePathname.mockReturnValue("/not-a-step");

    const { result } = renderHook(() => useDemoStep());

    expect(result.current).toBeNull();
  });

  it("returns null for the root path", () => {
    usePathname.mockReturnValue("/");

    const { result } = renderHook(() => useDemoStep());

    expect(result.current).toBeNull();
  });
});
