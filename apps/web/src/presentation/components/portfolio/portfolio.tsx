"use client";

import { useEffect, useState } from "react";
import { ROLE_HOME_COPY } from "@/application/navigation/shell-nav";
import type { PortfolioPort } from "@/application/ports/portfolio-port";
import type { WalletBalancePort } from "@/application/ports/wallet-balance-port";
import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import type { PortfolioSortMode } from "@/application/portfolio/sort";
import { createBrowserPortfolioPort } from "@/infrastructure/portfolio/create-portfolio-port";
import { createBrowserWalletConnectionPort } from "@/infrastructure/wallet/create-wallet-connection-port";
import { SimulatedWalletBalanceAdapter } from "@/infrastructure/wallet/simulated-wallet-balance-adapter";
import { usePortfolio } from "@/state/use-portfolio";
import { ErrorState } from "../error-state";
import { PageHeading } from "../page-heading";
import { Skeleton } from "../skeleton";
import { PortfolioView, type PortfolioWallet } from "./portfolio-view";

/**
 * `/portfolio` controller (Feature #426, WU2). It owns the SWR read, the wallet
 * card (rendered only when the API reports a connected public key — the
 * connect/empty/no-funds states are WU4) and the sort state; the presentation
 * lives in `portfolio-view.tsx`. The route is already `INVERSOR`-gated by
 * `(app)/layout.tsx`, so this never adds a second gate. Ports are injectable so
 * tests never touch the network, and are captured once with `useState` so an
 * omitted prop is never re-created.
 */

const COPY = ROLE_HOME_COPY.INVERSOR;

export interface PortfolioProps {
  /** Injectable for tests; production passes the browser port from the container. */
  readonly port?: PortfolioPort | null;
  /** Injectable for tests; production builds the browser wallet port lazily. */
  readonly connection?: WalletConnectionPort;
  /** Injectable for tests; production uses the deterministic demo balance. */
  readonly balance?: WalletBalancePort;
}

export function Portfolio({ port, connection, balance }: PortfolioProps) {
  const [resolvedPort] = useState<PortfolioPort | null>(() => port ?? null);
  const [defaultConnection] = useState<WalletConnectionPort>(() => createBrowserWalletConnectionPort());
  const [defaultBalance] = useState<WalletBalancePort>(() => new SimulatedWalletBalanceAdapter());
  const connectionPort = connection ?? defaultConnection;
  const balancePort = balance ?? defaultBalance;

  const [wallet, setWallet] = useState<PortfolioWallet | null>(null);
  const [sort, setSort] = useState<PortfolioSortMode>("recent");
  const state = usePortfolio(resolvedPort, true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const connectionState = await connectionPort.getConnection();
      if (!active || !connectionState.ok || connectionState.publicKey === null) return;
      const balanceState = await balancePort.getBalance(connectionState.publicKey);
      if (!active) return;
      setWallet({
        publicKey: connectionState.publicKey,
        frozen: connectionState.frozen,
        balanceXlm: balanceState.ok ? balanceState.balanceXlm : null
      });
    })();
    return () => {
      active = false;
    };
  }, [connectionPort, balancePort]);

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
          sort={sort}
          onSortChange={setSort}
          onDisconnect={() => setWallet(null)}
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
