"use client";

import type { WalletPort } from "@/application/ports/wallet-port";
import { FreighterWallet } from "@/infrastructure/wallet/freighter-wallet";
import { useWorkspaceViewModel } from "@/state/workspace-view-model";

/**
 * The wallet the demo shell uses when none is supplied. Held at module scope so
 * the connection callback keeps a stable dependency across renders.
 */
const defaultWallet = new FreighterWallet();

export interface WorkspaceStatusProps {
  /** Injected so the component can be exercised with a deterministic double. */
  readonly wallet?: WalletPort;
}

export function WorkspaceStatus({ wallet = defaultWallet }: WorkspaceStatusProps = {}) {
  const { status, connect } = useWorkspaceViewModel(wallet);

  return (
    <section>
      <h2>Vaqcrow Workspace</h2>
      <p>Status: {status}</p>
      <button type="button" onClick={connect}>
        Connect wallet
      </button>
    </section>
  );
}
