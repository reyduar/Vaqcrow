import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { MyDocumentsPort, MyDocumentsResult } from "@/application/ports/my-documents-port";
import { useMyDocuments } from "./use-my-documents";

const DOCUMENT = {
  documentId: "11111111-1111-4111-8111-111111111111",
  kind: "cuit" as const,
  name: "constancia-cuit.pdf",
  sizeBytes: 128_512,
  contentType: "application/pdf",
  createdAt: "2026-10-03T12:00:00.000Z"
};

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);

function port(result: MyDocumentsResult): MyDocumentsPort {
  return { listMine: vi.fn().mockResolvedValue(result) };
}

/**
 * The owner-scoped documents read (Feature #530, T5/S4). The hook can tell a
 * resolved list (including an honest empty one) apart from a failure; it never
 * turns a failed read into an invented empty list, and a missing backend is a
 * failure, not a perpetual "loading".
 */
describe("useMyDocuments", () => {
  it("reports a failure with a null port (no backend), never a perpetual loading", async () => {
    const { result } = renderHook(() => useMyDocuments(null, true), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.status).toBe("failed");
  });

  it("reports a failure while disabled", async () => {
    const listMine = vi.fn().mockResolvedValue({ ok: true, documents: [] });
    const { result } = renderHook(() => useMyDocuments({ listMine }, false), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(listMine).not.toHaveBeenCalled();
    expect(result.current.status).toBe("failed");
  });

  it("resolves the caller's own document metadata", async () => {
    const { result } = renderHook(() => useMyDocuments(port({ ok: true, documents: [DOCUMENT] }), true), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("ok"));
    expect(result.current).toEqual({ status: "ok", value: [DOCUMENT] });
  });

  it("resolves an owner with no documents as an ok empty list, distinct from a failure", async () => {
    const { result } = renderHook(() => useMyDocuments(port({ ok: true, documents: [] }), true), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("ok"));
    expect(result.current).toEqual({ status: "ok", value: [] });
  });

  it("reports a sanitized failure as failed, never an invented empty list", async () => {
    const { result } = renderHook(() => useMyDocuments(port({ ok: false, code: "unavailable" }), true), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("failed"));
  });

  it("reports a rejecting read as failed", async () => {
    const listMine = vi.fn().mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useMyDocuments({ listMine }, true), { wrapper });

    await waitFor(() => expect(listMine).toHaveBeenCalledTimes(1));
    expect(result.current.status).toBe("failed");
  });
});
