"use client";

import { useEffect, useState } from "react";
import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";

/**
 * Non-prompting "is a wallet connected?" read for the campaign-detail
 * contribution flow (Feature #422, WU3).
 *
 * The scripted `/funding` journey asks Freighter directly (`WalletPort`) and
 * owns a "Conectar wallet" button. The account-gated detail has no such button:
 * the template sends a person without a connected wallet to `/portfolio` to
 * connect or create Freighter. The signal is the **persisted** connection the
 * API stores for the signed-in principal (`GET /profile/wallet` through
 * `WalletConnectionPort`), which is the only "connected" fact available without
 * opening Freighter. A read failure is treated as "not connected" so the flow
 * falls back to `/portfolio` rather than pretending a wallet exists.
 */

export type WalletConnectedStatus = "loading" | "connected" | "disconnected";

export interface WalletConnectedState {
  readonly status: WalletConnectedStatus;
  readonly publicKey: string | null;
}

const LOADING: WalletConnectedState = { status: "loading", publicKey: null };
const DISCONNECTED: WalletConnectedState = { status: "disconnected", publicKey: null };

interface ReadState {
  readonly port: WalletConnectionPort;
  readonly state: WalletConnectedState;
}

export function useWalletConnected(port: WalletConnectionPort | null): WalletConnectedState {
  // The read is keyed by the port it belongs to, and state is written only from
  // the async callback — never synchronously in the effect body — so no
  // cascading render is triggered and a stale port's result is never reused.
  const [read, setRead] = useState<ReadState | null>(null);

  useEffect(() => {
    if (!port) return;
    let cancelled = false;
    port.getConnection().then(
      (result) => {
        if (cancelled) return;
        setRead({
          port,
          state:
            result.ok && result.publicKey
              ? { status: "connected", publicKey: result.publicKey }
              : DISCONNECTED
        });
      },
      () => {
        if (!cancelled) setRead({ port, state: DISCONNECTED });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [port]);

  if (!port) return DISCONNECTED;
  return read && read.port === port ? read.state : LOADING;
}
