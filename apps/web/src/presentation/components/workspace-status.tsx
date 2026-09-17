"use client";

import { FreighterWallet } from "@/infrastructure/wallet/freighter-wallet";
import { useWorkspaceViewModel } from "@/state/workspace-view-model";

const wallet = new FreighterWallet();

export function WorkspaceStatus() {
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
