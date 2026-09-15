import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WalletAccount, WalletPort } from "@/application/ports/wallet-port";
import { useWorkspaceViewModel } from "./workspace-view-model";

function createWallet(overrides: Partial<WalletPort> = {}): WalletPort {
  return {
    isAvailable: async () => true,
    connect: async () => {
      throw new Error("not implemented");
    },
    signTransaction: async () => {
      throw new Error("not implemented");
    },
    ...overrides
  };
}

describe("useWorkspaceViewModel", () => {
  it("starts in the not-connected status", () => {
    const { result } = renderHook(() => useWorkspaceViewModel(createWallet()));

    expect(result.current.status).toBe("not connected");
  });

  it("moves to connected when the wallet port resolves", async () => {
    const account: WalletAccount = { publicKey: "GABC123" };
    const wallet = createWallet({ connect: async () => account });
    const { result } = renderHook(() => useWorkspaceViewModel(wallet));

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.status).toBe("connected");
  });

  it("moves to connection failed when the wallet port rejects", async () => {
    const wallet = createWallet({
      connect: async () => {
        throw new Error("not implemented");
      }
    });
    const { result } = renderHook(() => useWorkspaceViewModel(wallet));

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.status).toBe("connection failed");
  });
});
