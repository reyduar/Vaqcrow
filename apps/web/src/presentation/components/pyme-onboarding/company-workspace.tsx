"use client";

import { useEffect, useState } from "react";
import { IoStorefrontOutline } from "react-icons/io5";
import { ROLE_HOME_COPY } from "@/application/navigation/shell-nav";
import { walletAccountExplorerUrl } from "@/application/pyme-onboarding/wallet-connection";
import type { KycPort } from "@/application/ports/kyc-port";
import type { UploadPort } from "@/application/ports/upload-port";
import type { WalletBalancePort } from "@/application/ports/wallet-balance-port";
import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import { SimulatedKycAdapter } from "@/infrastructure/kyc/simulated-kyc-adapter";
import { createBrowserUploadPort } from "@/infrastructure/upload/create-upload-port";
import { createBrowserWalletConnectionPort } from "@/infrastructure/wallet/create-wallet-connection-port";
import { SimulatedWalletBalanceAdapter } from "@/infrastructure/wallet/simulated-wallet-balance-adapter";
import { FOCUS_RING } from "../auth-field";
import { PageHeading } from "../page-heading";
import { WalletCard } from "../wallet-card";
import { PymeOnboardingWizard } from "./pyme-onboarding-wizard";

const COPY = ROLE_HOME_COPY.PYME;
const defaultKyc: KycPort = new SimulatedKycAdapter();

interface LoadedWallet {
  readonly publicKey: string;
  readonly frozen: boolean;
  readonly balanceXlm: string | null;
}

export interface CompanyWorkspaceProps {
  /** Injectable for tests; production uses the simulated KYC adapter. */
  readonly kyc?: KycPort;
  /** Injectable for tests; production builds the browser upload port lazily. */
  readonly upload?: UploadPort;
  /** Injectable for tests; production builds the browser wallet port lazily. */
  readonly connection?: WalletConnectionPort;
  /** Injectable for tests; production uses the deterministic demo balance. */
  readonly balance?: WalletBalancePort;
}

/**
 * `/company`: the PyME dashboard skeleton, the wallet card and the in-place
 * onboarding wizard.
 *
 * The card (Feature #406, Task #407 / T1c) reflects the wallet the PyME linked
 * in the wizard: the connection is read from the API and, when it exists, the
 * account's balance is read behind `WalletBalancePort` (deterministic, so no
 * pull-request verification touches Horizon). Connecting and replacing the key
 * stay in the wizard's step 4; `Desconectar` only clears this card's local view,
 * and is refused while the account is frozen.
 *
 * «Registrar mi PyME» always shows today: the "only while the PyME has no
 * registered company" rule needs the company registry (#398's later unit) and
 * is intentionally not implemented here. Opening the wizard never changes the
 * URL — the wizard lives inside `/company` and «Volver» restores this view.
 */
export function CompanyWorkspace({ kyc = defaultKyc, upload, connection, balance }: CompanyWorkspaceProps) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [defaultUpload] = useState<UploadPort>(() => createBrowserUploadPort());
  const [defaultConnection] = useState<WalletConnectionPort>(() => createBrowserWalletConnectionPort());
  const [defaultBalance] = useState<WalletBalancePort>(() => new SimulatedWalletBalanceAdapter());
  const [wallet, setWallet] = useState<LoadedWallet | null>(null);
  const uploadPort = upload ?? defaultUpload;
  const connectionPort = connection ?? defaultConnection;
  const balancePort = balance ?? defaultBalance;

  useEffect(() => {
    let active = true;
    void (async () => {
      const state = await connectionPort.getConnection();
      if (!active || !state.ok || state.publicKey === null) return;
      const stateBalance = await balancePort.getBalance(state.publicKey);
      if (!active) return;
      setWallet({
        publicKey: state.publicKey,
        frozen: state.frozen,
        balanceXlm: stateBalance.ok ? stateBalance.balanceXlm : null
      });
    })();
    return () => {
      active = false;
    };
  }, [connectionPort, balancePort]);

  if (wizardOpen) {
    return <PymeOnboardingWizard kyc={kyc} upload={uploadPort} onBack={() => setWizardOpen(false)} />;
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        title={COPY.title}
        subtitle={COPY.subtitle}
        action={
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className={`inline-flex h-12 items-center justify-center gap-2 rounded-control bg-brand-accent px-5 text-[15px] font-semibold whitespace-nowrap text-on-accent hover:bg-brand-accent-hover ${FOCUS_RING}`}
          >
            <IoStorefrontOutline aria-hidden="true" focusable="false" className="text-lg" />
            {COPY.registerCompany}
          </button>
        }
      />
      {wallet ? (
        <WalletCard
          publicKey={wallet.publicKey}
          frozen={wallet.frozen}
          balanceXlm={wallet.balanceXlm}
          explorerUrl={walletAccountExplorerUrl(wallet.publicKey)}
          onDisconnect={() => setWallet(null)}
        />
      ) : null}
    </div>
  );
}
