import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { InvestorKycPort } from "@/application/ports/investor-kyc-port";
import { useInvestorKyc } from "./use-investor-kyc";

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

const APPROVED_AT = "2026-10-08T18:30:00.000Z";
const APPROVED = { approved: true, approvedAt: APPROVED_AT, simulado: true } as const;
const ABSENT = { approved: false, approvedAt: null, simulado: true } as const;

function fakePort(overrides: Partial<InvestorKycPort> = {}) {
  const get = vi.fn().mockResolvedValue({ ok: true, status: APPROVED });
  const approve = vi.fn().mockResolvedValue({ ok: true, status: APPROVED });
  const port: InvestorKycPort = { get, approve, ...overrides };
  return { port, get, approve };
}

describe("useInvestorKyc", () => {
  it("fetches nothing while disabled", async () => {
    const { port, get } = fakePort();

    const { result } = renderHook(() => useInvestorKyc(port, false), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(get).not.toHaveBeenCalled();
    expect(result.current.approved).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("fetches nothing with a null port", async () => {
    const { result } = renderHook(() => useInvestorKyc(null, true), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.approved).toBe(false);
  });

  it("loads an approved status", async () => {
    const { port, get } = fakePort();

    const { result } = renderHook(() => useInvestorKyc(port, true), { wrapper });

    await waitFor(() => expect(result.current.approved).toBe(true));
    expect(get).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
  });

  it("stays not-approved on an absent record", async () => {
    const { port } = fakePort({ get: vi.fn().mockResolvedValue({ ok: true, status: ABSENT }) });

    const { result } = renderHook(() => useInvestorKyc(port, true), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.approved).toBe(false);
  });

  it("stays not-approved (not loading) when the read fails", async () => {
    const { port } = fakePort({ get: vi.fn().mockResolvedValue({ ok: false, code: "network" }) });

    const { result } = renderHook(() => useInvestorKyc(port, true), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.approved).toBe(false);
  });

  it("approve seeds the cache and resolves true", async () => {
    const { port } = fakePort({
      get: vi.fn().mockResolvedValue({ ok: true, status: ABSENT })
    });

    const { result } = renderHook(() => useInvestorKyc(port, true), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let approved = false;
    await act(async () => {
      approved = await result.current.approve();
    });

    expect(approved).toBe(true);
    expect(port.approve).toHaveBeenCalledTimes(1);
    expect(result.current.approved).toBe(true);
    // The server's own record seeds the cache; there is no extra re-read.
    expect(port.get).toHaveBeenCalledTimes(1);
  });

  it("approve resolves false on failure and changes nothing", async () => {
    const { port } = fakePort({
      get: vi.fn().mockResolvedValue({ ok: true, status: ABSENT }),
      approve: vi.fn().mockResolvedValue({ ok: false, code: "unavailable" })
    });

    const { result } = renderHook(() => useInvestorKyc(port, true), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let approved = true;
    await act(async () => {
      approved = await result.current.approve();
    });

    expect(approved).toBe(false);
    expect(result.current.approved).toBe(false);
  });

  it("does nothing without a port", async () => {
    const { result } = renderHook(() => useInvestorKyc(null, true), { wrapper });

    let approved = true;
    await act(async () => {
      approved = await result.current.approve();
    });

    expect(approved).toBe(false);
  });
});
