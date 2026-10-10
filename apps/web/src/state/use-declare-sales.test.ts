import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BusinessPort, BusinessRecord } from "@/application/ports/business-port";
import type {
  SalesDeclarationPeriod,
  SalesDeclarationPort,
  SalesDeclarationResult
} from "@/application/ports/sales-declaration-port";
import { useDeclareSales } from "./use-declare-sales";

const BUSINESS_ID = "b1e6c2a4-9f3d-4a7b-8c1e-5d2f6a9b0c31";

const PERIODS: readonly SalesDeclarationPeriod[] = [
  { period: "2026-01", salesArs: 1_850_000 },
  { period: "2026-02", salesArs: null }
];

function business(): BusinessRecord {
  return {
    businessId: BUSINESS_ID,
    ownerUserId: "owner-1",
    name: "Panadería Horizonte",
    cuit: "20123456789",
    sector: "Alimentos",
    city: "Córdoba",
    description: "Panadería de barrio",
    goalArs: 15_000_000,
    revenueShare: 5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function businessPort(result?: { ok: true } | { ok: false; code: string }): BusinessPort {
  return {
    getMyBusiness: vi.fn().mockResolvedValue(
      result ?? { ok: true, business: business() }
    ),
    createBusiness: vi.fn()
  } as unknown as BusinessPort;
}

function declarationPort(result: SalesDeclarationResult = { ok: true }) {
  const declare = vi.fn().mockResolvedValue(result);
  const port: SalesDeclarationPort = { declare };
  return { port, declare };
}

describe("useDeclareSales", () => {
  it("resolves the business id and declares the periods, then reports submitted", async () => {
    const { port, declare } = declarationPort();
    const onSubmitted = vi.fn();
    const { result } = renderHook(() => useDeclareSales(port, businessPort(), onSubmitted));

    await act(async () => {
      await result.current.submit(PERIODS);
    });

    expect(declare).toHaveBeenCalledWith(BUSINESS_ID, PERIODS);
    expect(onSubmitted).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.status).toBe("submitted"));
    expect(result.current.errorCode).toBeNull();
  });

  it("fails without a port and never reads the business", async () => {
    const business = businessPort();
    const { result } = renderHook(() => useDeclareSales(null, business));

    await act(async () => {
      await result.current.submit(PERIODS);
    });

    expect(result.current.status).toBe("failed");
    expect(result.current.errorCode).toBe("unavailable");
    expect(business.getMyBusiness).not.toHaveBeenCalled();
  });

  it("reports no_business when the owner has no registered company", async () => {
    const { port, declare } = declarationPort();
    const { result } = renderHook(() =>
      useDeclareSales(port, businessPort({ ok: false, code: "not_found" }))
    );

    await act(async () => {
      await result.current.submit(PERIODS);
    });

    expect(result.current.status).toBe("failed");
    expect(result.current.errorCode).toBe("no_business");
    expect(declare).not.toHaveBeenCalled();
  });

  it("maps a network failure while resolving the business", async () => {
    const { port } = declarationPort();
    const { result } = renderHook(() =>
      useDeclareSales(port, businessPort({ ok: false, code: "network" }))
    );

    await act(async () => {
      await result.current.submit(PERIODS);
    });

    expect(result.current.errorCode).toBe("network");
  });

  it("surfaces the sanitized code of a failed declaration", async () => {
    const { port } = declarationPort({ ok: false, code: "invalid_request" });
    const { result } = renderHook(() => useDeclareSales(port, businessPort()));

    await act(async () => {
      await result.current.submit(PERIODS);
    });

    expect(result.current.status).toBe("failed");
    expect(result.current.errorCode).toBe("invalid_request");
  });

  it("refuses a second submit while the first is in flight", async () => {
    let resolveDeclare: (value: SalesDeclarationResult) => void = () => undefined;
    const declare = vi.fn(
      () => new Promise<SalesDeclarationResult>((resolve) => (resolveDeclare = resolve))
    );
    const port: SalesDeclarationPort = { declare };
    const { result } = renderHook(() => useDeclareSales(port, businessPort()));

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.submit(PERIODS);
    });
    await act(async () => {
      await result.current.submit(PERIODS);
    });

    expect(declare).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveDeclare({ ok: true });
      await first;
    });
  });

  it("resets back to idle", async () => {
    const { port } = declarationPort({ ok: false, code: "unavailable" });
    const { result } = renderHook(() => useDeclareSales(port, businessPort()));

    await act(async () => {
      await result.current.submit(PERIODS);
    });
    expect(result.current.status).toBe("failed");

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.errorCode).toBeNull();
  });
});
