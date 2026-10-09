"use client";

import { useEffect, useMemo, useState } from "react";
import { IoStorefrontOutline } from "react-icons/io5";
import type { ApplicationReviewState } from "@vaqcrow/contracts";
import { ROLE_HOME_COPY } from "@/application/navigation/shell-nav";
import { walletAccountExplorerUrl } from "@/application/pyme-onboarding/wallet-connection";
import type { KycPort } from "@/application/ports/kyc-port";
import type { MyCampaignsPort } from "@/application/ports/my-campaigns-port";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import type { UploadPort } from "@/application/ports/upload-port";
import type { WalletBalancePort } from "@/application/ports/wallet-balance-port";
import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import { SimulatedKycAdapter } from "@/infrastructure/kyc/simulated-kyc-adapter";
import { createBrowserSmeRequestGateway } from "@/infrastructure/sme/default-gateway";
import { createBrowserUploadPort } from "@/infrastructure/upload/create-upload-port";
import { createBrowserWalletConnectionPort } from "@/infrastructure/wallet/create-wallet-connection-port";
import { SimulatedWalletBalanceAdapter } from "@/infrastructure/wallet/simulated-wallet-balance-adapter";
import { useSmeRequestState } from "@/state/use-sme-request";
import { FOCUS_RING } from "../auth-field";
import { CompanyApplicationState } from "../company/company-application-state";
import { CompanyDashboardContainer } from "../company/company-dashboard";
import { CompanyTestnetFunds } from "../company/company-testnet-funds";
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

/**
 * Wraps a gateway so the application id returned by `submit` is captured at its
 * creation boundary (Feature #434, WU5 / B1), without the wizard knowing. `load`
 * is forwarded unchanged; a `null` gateway stays `null` so the wizard still sees
 * «no backend».
 */
export function captureApplicationIdOnSubmit(
  gateway: SmeRequestGateway | null,
  onCaptured: (applicationId: string) => void
): SmeRequestGateway | null {
  if (gateway === null) return null;
  return {
    load: (id) => gateway.load(id),
    submit: async (request) => {
      const result = await gateway.submit(request);
      onCaptured(result.applicationId);
      return result;
    }
  };
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
  /** Injectable for tests; production builds the browser dashboard port lazily. */
  readonly myCampaigns?: MyCampaignsPort;
  /**
   * The PyME's application review state (Feature #434, WU5, D6). `undefined`
   * means the state has not been read (the banner is not rendered); `null` is a
   * read that found no application yet, which renders the «Sin enviar» state.
   * An explicit value wins over the read — tests and a future caller use it.
   */
  readonly applicationState?: ApplicationReviewState | null;
  /**
   * The application id to read the state for. Production captures it from the
   * wizard's submit (see the wrapped gateway below); this prop is the test seam
   * and the future owner-scoped-read seam.
   */
  readonly applicationId?: string | null;
  /** Injectable for tests; production builds the session-aware browser gateway. */
  readonly smeRequestGateway?: SmeRequestGateway | null;
}

/**
 * `/company`: the PyME dashboard skeleton, the wallet card, the application
 * state banner, the Testnet funds guide and the in-place onboarding wizard.
 *
 * The card (Feature #406, Task #407 / T1c) reflects the wallet the PyME linked
 * in the wizard: the connection is read from the API and, when it exists, the
 * account's balance is read behind `WalletBalancePort` (deterministic, so no
 * pull-request verification touches Horizon). Connecting and replacing the key
 * stay in the wizard's step 4; `Desconectar` only clears this card's local view,
 * and is refused while the account is frozen.
 *
 * WU5 adds the application-state banner (D6) and the Testnet funds guide (D5):
 * the guide points at Friendbot so the PyME funds its own wallet, and the
 * banner reads the PyME's own review state from `GET /sme-requests/:id`
 * (`useSmeRequestState`) for the application id captured from the wizard's
 * send. A returning PyME with no in-session submit has no id and sees no banner
 * until an owner-scoped read exists (WU5 advisory).
 *
 * «Registrar mi PyME» always shows today: the "only while the PyME has no
 * registered company" rule needs the company registry (#398's later unit) and
 * is intentionally not implemented here. Opening the wizard never changes the
 * URL — the wizard lives inside `/company` and «Volver» restores this view.
 */
export function CompanyWorkspace({
  kyc = defaultKyc,
  upload,
  connection,
  balance,
  myCampaigns,
  applicationState,
  applicationId,
  smeRequestGateway
}: CompanyWorkspaceProps) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [defaultUpload] = useState<UploadPort>(() => createBrowserUploadPort());
  const [defaultConnection] = useState<WalletConnectionPort>(() => createBrowserWalletConnectionPort());
  const [defaultBalance] = useState<WalletBalancePort>(() => new SimulatedWalletBalanceAdapter());
  const [defaultSmeGateway] = useState<SmeRequestGateway | null>(() => createBrowserSmeRequestGateway());
  const [wallet, setWallet] = useState<LoadedWallet | null>(null);
  const [capturedApplicationId, setCapturedApplicationId] = useState<string | null>(null);
  const uploadPort = upload ?? defaultUpload;
  const connectionPort = connection ?? defaultConnection;
  const balancePort = balance ?? defaultBalance;
  const smeGateway = smeRequestGateway === undefined ? defaultSmeGateway : smeRequestGateway;

  // The id is captured at its creation boundary: the wizard's send returns it,
  // and the wrapped gateway records it without the wizard knowing. The read is
  // provider-free (`useSmeRequestState`), because `/company` mounts no journey
  // store. A returning PyME with no in-session submit has no id and sees no
  // banner until an owner-scoped read exists (WU5 advisory).
  const effectiveApplicationId = capturedApplicationId ?? applicationId ?? null;
  const readState = useSmeRequestState(smeGateway, effectiveApplicationId);
  const resolvedState = applicationState === undefined ? readState : applicationState;

  const captureGateway = useMemo<SmeRequestGateway | null>(
    () => captureApplicationIdOnSubmit(smeGateway, setCapturedApplicationId),
    [smeGateway]
  );

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
    return (
      <PymeOnboardingWizard
        kyc={kyc}
        upload={uploadPort}
        gateway={captureGateway}
        onBack={() => setWizardOpen(false)}
      />
    );
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
      {resolvedState === undefined ? null : <CompanyApplicationState state={resolvedState} />}
      {wallet ? (
        <WalletCard
          publicKey={wallet.publicKey}
          frozen={wallet.frozen}
          balanceXlm={wallet.balanceXlm}
          explorerUrl={walletAccountExplorerUrl(wallet.publicKey)}
          onDisconnect={() => setWallet(null)}
        />
      ) : null}
      <CompanyTestnetFunds publicKey={wallet?.publicKey ?? null} />
      <CompanyDashboardContainer {...(myCampaigns ? { port: myCampaigns } : {})} />
    </div>
  );
}
