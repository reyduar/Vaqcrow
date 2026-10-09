"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_HOME_COPY } from "@/application/navigation/shell-nav";
import type { PortfolioPort } from "@/application/ports/portfolio-port";
import type { WalletBalancePort } from "@/application/ports/wallet-balance-port";
import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import type { WalletPort } from "@/application/ports/wallet-port";
import type { PortfolioSortMode } from "@/application/portfolio/sort";
import { createBrowserPortfolioPort } from "@/infrastructure/portfolio/create-portfolio-port";
import { createBrowserWalletConnectionPort } from "@/infrastructure/wallet/create-wallet-connection-port";
import { FreighterWallet } from "@/infrastructure/wallet/freighter-wallet";
import { SimulatedWalletBalanceAdapter } from "@/infrastructure/wallet/simulated-wallet-balance-adapter";
import { usePortfolio } from "@/state/use-portfolio";
import { ErrorState } from "../error-state";
import { PageHeading } from "../page-heading";
import { Skeleton } from "../skeleton";
import { PortfolioView, type PortfolioWallet } from "./portfolio-view";

/**
 * `/portfolio` controller (Feature #426, WU2; wallet states #426/WU4). It owns
 * the SWR read, the wallet surface — the connected card when the API reports a
 * key, the connect-mode card otherwise — and the sort state; the presentation
 * lives in `portfolio-view.tsx`. The route is already `INVERSOR`-gated by
 * `(app)/layout.tsx`, so this never adds a second gate. Ports are injectable so
 * tests never touch the network or the Freighter extension, and are captured
 * once with `useState` so an omitted prop is never re-created.
 *
 * A successful connect refreshes both reads: the persisted connection (for the
 * key/balance) and the portfolio summary (the contribution behind it).
 * `Desconectar` remains a local disconnect (hide the card → connect-mode) — a
 * persisted disconnect would need a new API route and is out of scope here.
 */

const COPY = ROLE_HOME_COPY.INVERSOR;

export interface PortfolioProps {
  /** Injectable for tests; production passes the browser port from the container. */
  readonly port?: PortfolioPort | null;
  /** Injectable for tests; production builds the browser wallet port lazily. */
  readonly connection?: WalletConnectionPort;
  /** Injectable for tests; production uses the deterministic demo balance. */
  readonly balance?: WalletBalancePort;
  /** Injectable for tests; production uses the real Freighter adapter. */
  readonly wallet?: WalletPort;
}

export function Portfolio({ port, connection, balance, wallet: injectedWallet }: PortfolioProps) {
  const [resolvedPort] = useState<PortfolioPort | null>(() => port ?? null);
  const [defaultConnection] = useState<WalletConnectionPort>(() => createBrowserWalletConnectionPort());
  const [defaultBalance] = useState<WalletBalancePort>(() => new SimulatedWalletBalanceAdapter());
  const [defaultWallet] = useState<WalletPort>(() => new FreighterWallet());
  const connectionPort = connection ?? defaultConnection;
  const balancePort = balance ?? defaultBalance;
  const walletPort = injectedWallet ?? defaultWallet;

  const [wallet, setWallet] = useState<PortfolioWallet | null>(null);
  const [sort, setSort] = useState<PortfolioSortMode>("recent");
  const state = usePortfolio(resolvedPort, true);
  const { reload } = state;
  const router = useRouter();

  const readWallet = useCallback(async (): Promise<PortfolioWallet | null> => {
    const connectionState = await connectionPort.getConnection();
    if (!connectionState.ok || connectionState.publicKey === null) return null;
    const balanceState = await balancePort.getBalance(connectionState.publicKey);
    return {
      publicKey: connectionState.publicKey,
      frozen: connectionState.frozen,
      balanceXlm: balanceState.ok ? balanceState.balanceXlm : null
    };
  }, [connectionPort, balancePort]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const loaded = await readWallet();
      if (active) setWallet(loaded);
    })();
    return () => {
      active = false;
    };
  }, [readWallet]);

  const handleConnected = useCallback(() => {
    void (async () => {
      const loaded = await readWallet();
      setWallet(loaded);
      reload();
    })();
  }, [readWallet, reload]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeading title={COPY.title} subtitle={COPY.subtitle} />
      {state.isLoading ? (
        <Skeleton shapes={["card", "line", "line"]} label="Cargando tu portafolio" />
      ) : state.loadFailed || state.summary === null ? (
        <ErrorState
          title="No pudimos cargar tu portafolio"
          message="El servicio no respondió. Ningún dato ni aporte se modificó."
          onRetry={state.reload}
          retryLabel="Reintentar"
        />
      ) : (
        <PortfolioView
          summary={state.summary}
          wallet={wallet}
          walletPort={walletPort}
          connectionPort={connectionPort}
          onConnected={handleConnected}
          sort={sort}
          onSortChange={setSort}
          onDisconnect={() => setWallet(null)}
          onExplore={() => router.push("/explore")}
          onActionSubmitted={state.reload}
        />
      )}
    </div>
  );
}

/** The browser-wired entry point: the `(app)/portfolio` route mounts this. */
export function PortfolioContainer() {
  const [port] = useState(() => createBrowserPortfolioPort());
  return <Portfolio port={port} />;
}
