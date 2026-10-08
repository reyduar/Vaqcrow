import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { FavoritePort } from "@/application/ports/favorite-port";
import { useFavorites } from "./use-favorites";

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

const A = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const B = "9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";

function fakePort(campaignIds: readonly string[] = [A]) {
  const list = vi.fn().mockResolvedValue({ ok: true, campaignIds });
  const add = vi.fn().mockResolvedValue({ ok: true, applied: true });
  const remove = vi.fn().mockResolvedValue({ ok: true, applied: false });
  const port: FavoritePort = { list, add, remove };
  return { port, list, add, remove };
}

describe("useFavorites", () => {
  it("fetches nothing while disabled", async () => {
    const { port, list } = fakePort();

    const { result } = renderHook(() => useFavorites(port, false), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(list).not.toHaveBeenCalled();
    expect(result.current.campaignIds.size).toBe(0);
    expect(result.current.loadFailed).toBe(false);
  });

  it("fetches nothing with a null port", async () => {
    const { result } = renderHook(() => useFavorites(null, true), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.campaignIds.size).toBe(0);
    expect(result.current.loadFailed).toBe(false);
  });

  it("loads the favorited ids into a set", async () => {
    const { port, list } = fakePort([A, B]);

    const { result } = renderHook(() => useFavorites(port, true), { wrapper });

    await waitFor(() => expect(result.current.campaignIds.size).toBe(2));
    expect(list).toHaveBeenCalledTimes(1);
    expect(result.current.campaignIds.has(A)).toBe(true);
    expect(result.current.loadFailed).toBe(false);
  });

  it("reports a failure without inventing favorites", async () => {
    const port: FavoritePort = {
      list: vi.fn().mockResolvedValue({ ok: false, code: "network" }),
      add: vi.fn(),
      remove: vi.fn()
    };

    const { result } = renderHook(() => useFavorites(port, true), { wrapper });

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.campaignIds.size).toBe(0);
  });

  it("adds an unfavorited campaign and re-reads", async () => {
    const { port, list, add } = fakePort([A]);
    const { result } = renderHook(() => useFavorites(port, true), { wrapper });
    await waitFor(() => expect(result.current.campaignIds.size).toBe(1));
    expect(list).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.toggle(B);
    });

    expect(add).toHaveBeenCalledWith(B);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("removes an already-favorited campaign and re-reads", async () => {
    const { port, list, remove } = fakePort([A]);
    const { result } = renderHook(() => useFavorites(port, true), { wrapper });
    await waitFor(() => expect(result.current.campaignIds.size).toBe(1));

    await act(async () => {
      await result.current.toggle(A);
    });

    expect(remove).toHaveBeenCalledWith(A);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("keeps the previous state and does not re-read when a toggle fails", async () => {
    const { port, list } = fakePort([A]);
    (port.add as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, code: "network" });
    const { result } = renderHook(() => useFavorites(port, true), { wrapper });
    await waitFor(() => expect(result.current.campaignIds.size).toBe(1));

    await act(async () => {
      await result.current.toggle(B);
    });

    expect(port.add).toHaveBeenCalledWith(B);
    expect(result.current.campaignIds.size).toBe(1);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("never mutates on an unauthenticated toggle", async () => {
    const { port, list } = fakePort([A]);
    (port.add as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, code: "unauthenticated" });
    const { result } = renderHook(() => useFavorites(port, true), { wrapper });
    await waitFor(() => expect(result.current.campaignIds.size).toBe(1));

    await act(async () => {
      await result.current.toggle(B);
    });

    expect(list).toHaveBeenCalledTimes(1);
    expect(result.current.campaignIds.has(B)).toBe(false);
  });

  it("does nothing without a port", async () => {
    const { result } = renderHook(() => useFavorites(null, true), { wrapper });
    await act(async () => {
      await result.current.toggle(A);
    });
    expect(result.current.campaignIds.size).toBe(0);
  });
});
