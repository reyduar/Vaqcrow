"use client";

import { useEffect, useMemo, useState } from "react";
import { IoDocumentTextOutline, IoStorefrontOutline } from "react-icons/io5";
import type { ApplicationReviewState } from "@vaqcrow/contracts";
import { canRegisterCompany } from "@/application/company/can-register-company";
import { SUBMITTED_DATA_COPY } from "@/application/company/submitted-data";
import { ROLE_HOME_COPY } from "@/application/navigation/shell-nav";
import {
  connectAndStoreWallet,
  walletAccountExplorerUrl,
  walletConnectFailureCopy
} from "@/application/pyme-onboarding/wallet-connection";
import type { BusinessPort } from "@/application/ports/business-port";
import type { KycPort } from "@/application/ports/kyc-port";
import type { MyCampaignsPort } from "@/application/ports/my-campaigns-port";
import type { MyDocumentsPort } from "@/application/ports/my-documents-port";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import type { UploadPort } from "@/application/ports/upload-port";
import type { WalletBalancePort } from "@/application/ports/wallet-balance-port";
import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import type { WalletPort } from "@/application/ports/wallet-port";
import { SimulatedKycAdapter } from "@/infrastructure/kyc/simulated-kyc-adapter";
import { createBrowserSmeRequestGateway } from "@/infrastructure/sme/default-gateway";
import { createBrowserUploadPort } from "@/infrastructure/upload/create-upload-port";
import { createBrowserWalletConnectionPort } from "@/infrastructure/wallet/create-wallet-connection-port";
import { FreighterWallet } from "@/infrastructure/wallet/freighter-wallet";
import { HorizonWalletBalanceAdapter } from "@/infrastructure/wallet/horizon-wallet-balance-adapter";
import { createBrowserRatePort } from "@/infrastructure/rates/create-rate-port";
import { useCurrentRate } from "@/state/use-current-rate";
import { xlmToArs } from "@/application/format/ars";
import type { RatePort } from "@/application/ports/rate-port";
import { useMyApplication } from "@/state/use-my-application";
import { useRefreshOnReturn } from "@/state/use-refresh-on-return";
import { useSmeRequestState } from "@/state/use-sme-request";
import { FOCUS_RING } from "../auth-field";
import { CompanyApplicationState } from "../company/company-application-state";
import { CompanyDashboardContainer } from "../company/company-dashboard";
import { CompanySubmittedData } from "../company/company-submitted-data";
import { CompanyTestnetFunds } from "../company/company-testnet-funds";
import { PageHeading } from "../page-heading";
import { WalletCard } from "../wallet-card";
import { PymeOnboardingWizard } from "./pyme-onboarding-wizard";

const COPY = ROLE_HOME_COPY.PYME;
const defaultKyc: KycPort = new SimulatedKycAdapter();
/** The Freighter signer the funds guide connects with; module scope keeps it stable across renders. */
const defaultWallet: WalletPort = new FreighterWallet();

interface LoadedWallet {
  readonly publicKey: string;
  readonly frozen: boolean;
  readonly balanceXlm: string | null;
}

/**
 * Wraps a gateway so the application id returned by `submit` is captured at its
 * creation boundary (Feature #434, WU5 / B1), without the wizard knowing. `load`
 * and `loadMine` are forwarded unchanged; a `null` gateway stays `null` so the
 * wizard still sees «no backend».
 */
export function captureApplicationIdOnSubmit(
  gateway: SmeRequestGateway | null,
  onCaptured: (applicationId: string) => void
): SmeRequestGateway | null {
  if (gateway === null) return null;
  return {
    load: (id) => gateway.load(id),
    loadMine: () => gateway.loadMine(),
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
  /** Freighter signer the funds guide connects with; injectable for tests. */
  readonly walletPort?: WalletPort;
  /** Injectable for tests; production reads the balance from Testnet Horizon (#557). */
  readonly balance?: WalletBalancePort;
  /** Injectable for tests; production reads `GET /rates/current` (#572). */
  readonly rates?: RatePort;
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
  /** Injectable for tests; the «Ver lo enviado» panel builds the browser company port when absent. */
  readonly business?: BusinessPort | null;
  /** Injectable for tests; the «Ver lo enviado» panel builds the browser documents port when absent. */
  readonly documents?: MyDocumentsPort | null;
}

/**
 * `/company`: the PyME dashboard skeleton, the wallet card, the application
 * state banner, the Testnet funds guide and the in-place onboarding wizard.
 *
 * The card (Feature #406, Task #407 / T1c) reflects the wallet the PyME linked
 * in the wizard: the connection is read from the API and, when it exists, the
 * account's balance is read behind `WalletBalancePort` — from Testnet Horizon
 * since #557, re-read whenever the PyME returns to the tab (Friendbot opens in a
 * new one); tests inject a double, so no pull-request verification touches
 * Horizon. Connecting and replacing the key
 * stay in the wizard's step 4; `Desconectar` only clears this card's local view,
 * and is refused while the account is frozen.
 *
 * WU5 adds the application-state banner (D6) and the Testnet funds guide (D5);
 * #531 reworks the guide so its primary action connects Freighter and, once
 * connected, shows the account's balance plus whether it still needs Testnet
 * XLM for the vault deploy — Friendbot is only secondary help. The banner reads
 * the PyME's own review state from `GET /sme-requests/:id`
 * (`useSmeRequestState`) for the resolved application id.
 *
 * Feature #530 (T3/T4) resolves that id owner-scoped: the in-session captured id
 * wins, else the id from `GET /sme-requests/mine` (`useMyApplication`), so a
 * returning PyME in a fresh session (S6) sees its real state. «Registrar mi
 * PyME» is then shown only for «Sin enviar» (`canRegisterCompany`): no
 * application, an unknown read, or a `draft`. Every other state — in review
 * (S1), approved (S2), `changes_requested`/`rejected` (S3) — hides it.
 * Feature #530 (T5/S1/S4) then offers «Ver lo enviado» instead: it opens the
 * read-only `CompanySubmittedData` panel over the persisted facts, which
 * replaces this body while open and returns to it on close. Opening the wizard
 * never changes the URL — the wizard lives inside `/company` and «Volver»
 * restores this view.
 */
export function CompanyWorkspace({
  kyc = defaultKyc,
  upload,
  connection,
  walletPort,
  balance,
  rates,
  myCampaigns,
  applicationState,
  applicationId,
  smeRequestGateway,
  business,
  documents
}: CompanyWorkspaceProps) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [submittedOpen, setSubmittedOpen] = useState(false);
  const [defaultUpload] = useState<UploadPort>(() => createBrowserUploadPort());
  const [defaultConnection] = useState<WalletConnectionPort>(() => createBrowserWalletConnectionPort());
  const [defaultBalance] = useState<WalletBalancePort>(() => HorizonWalletBalanceAdapter.create());
  const [defaultRates] = useState<RatePort>(() => createBrowserRatePort());
  const rate = useCurrentRate(rates ?? defaultRates);
  const [defaultSmeGateway] = useState<SmeRequestGateway | null>(() => createBrowserSmeRequestGateway());
  const [wallet, setWallet] = useState<LoadedWallet | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [capturedApplicationId, setCapturedApplicationId] = useState<string | null>(null);
  const uploadPort = upload ?? defaultUpload;
  const connectionPort = connection ?? defaultConnection;
  const walletSigner = walletPort ?? defaultWallet;
  const balancePort = balance ?? defaultBalance;
  const smeGateway = smeRequestGateway === undefined ? defaultSmeGateway : smeRequestGateway;

  // The id is resolved owner-scoped (Feature #530, S6): the in-session captured
  // id wins, else the id of the PyME's own application read from the API — so a
  // returning PyME in a fresh session sees the right state without submitting
  // again. The banner read (`useSmeRequestState`) then loads that id.
  const mine = useMyApplication(smeGateway, true);
  const effectiveApplicationId = capturedApplicationId ?? mine?.applicationId ?? applicationId ?? null;
  const readState = useSmeRequestState(smeGateway, effectiveApplicationId);
  const resolvedState = applicationState === undefined ? (mine?.state ?? readState) : applicationState;

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

  // #557: after Friendbot funds the account in another tab, coming back re-reads
  // the balance so the card and the funds guide stop saying «sin saldo».
  const linkedPublicKey = wallet?.publicKey ?? null;
  useRefreshOnReturn(() => {
    if (linkedPublicKey === null) return;
    void (async () => {
      const stateBalance = await balancePort.getBalance(linkedPublicKey);
      setWallet((current) =>
        current === null || current.publicKey !== linkedPublicKey
          ? current
          : { ...current, balanceXlm: stateBalance.ok ? stateBalance.balanceXlm : null }
      );
    })();
  });

  // The funds guide's primary action (#531): the same connect → challenge →
  // sign → store sequence the wizard's review step uses, then the account's
  // balance is read so the guide can say whether it can pay for the vault
  // deploy. A failure is shown sanitized; the connection is never faked.
  async function connectWallet(): Promise<void> {
    if (connecting) return;
    setConnecting(true);
    setConnectError(null);
    const outcome = await connectAndStoreWallet(walletSigner, connectionPort);
    if (!outcome.ok) {
      setConnectError(walletConnectFailureCopy(outcome));
      setConnecting(false);
      return;
    }
    const { publicKey, frozen } = outcome.connection;
    const stateBalance = await balancePort.getBalance(publicKey);
    setWallet({ publicKey, frozen, balanceXlm: stateBalance.ok ? stateBalance.balanceXlm : null });
    setConnecting(false);
  }

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

  // «Ver lo enviado» (Feature #530, T5/S1/S4): the read-only view of what was
  // persisted. It replaces the normal `/company` body while open and returns to
  // it on close, exactly like the wizard.
  if (submittedOpen) {
    return (
      <CompanySubmittedData
        applicationId={effectiveApplicationId}
        smeRequestGateway={smeGateway}
        onClose={() => setSubmittedOpen(false)}
        {...(business !== undefined ? { business } : {})}
        {...(documents !== undefined ? { documents } : {})}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        title={COPY.title}
        subtitle={COPY.subtitle}
        action={
          canRegisterCompany(resolvedState) ? (
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className={`inline-flex h-12 items-center justify-center gap-2 rounded-control bg-brand-accent px-5 text-[15px] font-semibold whitespace-nowrap text-on-accent hover:bg-brand-accent-hover ${FOCUS_RING}`}
            >
              <IoStorefrontOutline aria-hidden="true" focusable="false" className="text-lg" />
              {COPY.registerCompany}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSubmittedOpen(true)}
              className={`inline-flex h-12 items-center justify-center gap-2 rounded-control border border-control px-5 text-[15px] font-semibold whitespace-nowrap text-text-primary hover:bg-page-surface ${FOCUS_RING}`}
            >
              <IoDocumentTextOutline aria-hidden="true" focusable="false" className="text-lg" />
              {SUBMITTED_DATA_COPY.openLabel}
            </button>
          )
        }
      />
      {resolvedState === undefined ? null : <CompanyApplicationState state={resolvedState} />}
      {wallet ? (
        <WalletCard
          publicKey={wallet.publicKey}
          frozen={wallet.frozen}
          balanceXlm={wallet.balanceXlm}
          balanceArs={xlmToArs(wallet.balanceXlm, rate)}
          explorerUrl={walletAccountExplorerUrl(wallet.publicKey)}
          onDisconnect={() => {
            setWallet(null);
            setConnectError(null);
          }}
        />
      ) : null}
      <CompanyTestnetFunds
        publicKey={wallet?.publicKey ?? null}
        balanceXlm={wallet?.balanceXlm ?? null}
        onConnect={() => void connectWallet()}
        connecting={connecting}
        error={connectError}
      />
      <CompanyDashboardContainer {...(myCampaigns ? { port: myCampaigns } : {})} />
    </div>
  );
}
