import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeWalletConnection } from "@/test/fake-wallet";
import { useWalletConnected } from "./use-wallet-connected";

const INVESTOR = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

describe("useWalletConnected", () => {
  it("is disconnected while no connection is read (no port)", () => {
    const { result } = renderHook(() => useWalletConnected(null));
    expect(result.current).toEqual({ status: "disconnected", publicKey: null });
  });

  it("resolves connected with the persisted public key", async () => {
    const port = new FakeWalletConnection({ publicKey: INVESTOR, frozen: false });
    const { result } = renderHook(() => useWalletConnected(port));

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("connected"));
    expect(result.current.publicKey).toBe(INVESTOR);
  });

  it("resolves disconnected when the account never linked a wallet", async () => {
    const port = new FakeWalletConnection({ publicKey: null, frozen: false });
    const { result } = renderHook(() => useWalletConnected(port));

    await waitFor(() => expect(result.current.status).toBe("disconnected"));
    expect(result.current.publicKey).toBeNull();
  });

  it("treats a failed read as disconnected, never as a connected wallet", async () => {
    const port = new FakeWalletConnection();
    port.failNextGet("unavailable");
    const { result } = renderHook(() => useWalletConnected(port));

    await waitFor(() => expect(result.current.status).toBe("disconnected"));
    expect(result.current.publicKey).toBeNull();
  });
});
