import { useCallback, useState } from "react";
import type { WalletPort } from "@/application/ports/wallet-port";

export type WorkspaceConnectionStatus =
  | "not connected"
  | "connecting"
  | "connected"
  | "connection failed";

export interface WorkspaceViewModel {
  readonly status: WorkspaceConnectionStatus;
  readonly connect: () => Promise<void>;
}

export function useWorkspaceViewModel(wallet: WalletPort): WorkspaceViewModel {
  const [status, setStatus] = useState<WorkspaceConnectionStatus>("not connected");

  const connect = useCallback(async () => {
    setStatus("connecting");
    try {
      await wallet.connect();
      setStatus("connected");
    } catch {
      setStatus("connection failed");
    }
  }, [wallet]);

  return { status, connect };
}
