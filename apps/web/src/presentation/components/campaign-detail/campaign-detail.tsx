"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PrincipalRole } from "@/application/ports/auth-session-port";
import type { CampaignDetailPort } from "@/application/ports/campaign-detail-port";
import { createBrowserCampaignDetailPort } from "@/infrastructure/campaign/create-campaign-detail-port";
import { useSession } from "@/state/session-store-provider";
import { useCampaignDetail } from "@/state/use-campaign-detail";
import { BackendNotice } from "../backend-notice";
import { ErrorState } from "../error-state";
import { Skeleton } from "../skeleton";
import { CampaignDetailView } from "./campaign-detail-view";
import type { CampaignContributionInjection } from "./campaign-contribution";

/**
 * Campaign detail controller (Feature #422, WU2; public since #485).
 *
 * The route and the detail are **public**: a shared link is readable without a
 * session, so a signed-out visitor fetches and sees the detail. There is no
 * login gate — the template's «Ingresá para ver esta campaña» card was retired
 * by the owner's decision on #485, and the human-decision `actor` is neutralized
 * by the API so a shared link never exposes an operator's name.
 *
 * The controller owns the states — loading, error+retry, 404, the "no backend
 * configured" notice and the detail — driven only by `useCampaignDetail`, never
 * by locally invented data. Only the contribution and withdraw flows are
 * gated, and not here: `CampaignDetailView` mounts them only for a verified
 * `INVERSOR` on a funding campaign, so a signed-out visitor sees no CTA.
 */

export interface CampaignDetailProps {
  readonly campaignId: string;
  /** The verified viewer role; only `INVERSOR` may contribute (WU3). */
  readonly role?: PrincipalRole | null;
  /** Injectable for tests; `null`/omitted forces "no backend". */
  readonly port?: CampaignDetailPort | null;
  /** Injectable contribution ports/navigation; production wires them in the container. */
  readonly contribution?: CampaignContributionInjection;
}

/** An unpublished or unknown campaign: a clear dead end with a way back. */
export function CampaignDetailNotFound() {
  return (
    <div className="mx-auto mt-8 flex w-full max-w-[560px] flex-col items-center gap-4 rounded-card border border-border px-8 py-12 text-center">
      <h1 className="m-0 text-[30px] leading-tight font-bold tracking-[-0.02em]">No encontramos esta campaña</h1>
      <p className="m-0 max-w-[44ch] text-base text-pretty text-text-secondary">
        Puede que no esté publicada o que el enlace ya no sea válido.
      </p>
      <Link
        href="/explore"
        className="inline-flex h-12 items-center rounded-control border border-control px-[18px] text-[15px] font-semibold text-text-primary hover:bg-page-surface"
      >
        Volver a Explorar PyMEs
      </Link>
    </div>
  );
}

export function CampaignDetail({ campaignId, role = null, port, contribution }: CampaignDetailProps) {
  // Captured once: an omitted prop stays null, so a test's injected port is
  // never re-created and the browser port is created only by the container.
  const [resolvedPort] = useState<CampaignDetailPort | null>(() => port ?? null);
  // Public read (#485): fetch regardless of session; the port attaches a token
  // only when there is one, and the API answers a public route either way.
  const state = useCampaignDetail(campaignId, resolvedPort, true);

  if (state.isLoading) return <Skeleton shapes={["card", "line", "line"]} label="Cargando campaña" />;
  if (state.notFound) return <CampaignDetailNotFound />;
  // #480: "no backend configured" and "nothing fetched" get the calm notice;
  // only a genuine failure gets the (softened) error panel.
  if (state.loadErrorCode === "not_configured") return <BackendNotice />;
  if (state.loadFailed) {
    return (
      <ErrorState
        title="No pudimos cargar la campaña"
        message="El servicio no respondió. Ningún dato ni aporte se modificó."
        onRetry={state.reload}
        retryLabel="Reintentar"
      />
    );
  }
  if (state.detail === null) return <BackendNotice />;
  return (
    <CampaignDetailView
      detail={state.detail}
      role={role}
      {...(contribution ? { contribution } : {})}
      onContributionSubmitted={state.reload}
    />
  );
}

/**
 * Browser-wired entry point. It injects the browser port and reads only the
 * viewer's role (for the contribution gate); `null`/omitted `port` means the
 * browser default, so tests can inject a fake. Without a connected wallet the
 * contribution CTA sends the person to `/portfolio` to connect or create
 * Freighter (the template's behaviour).
 */
export function CampaignDetailContainer({
  campaignId,
  port
}: {
  readonly campaignId: string;
  readonly port?: CampaignDetailPort | null;
}) {
  const role = useSession((state) => state.principal?.role ?? null);
  const router = useRouter();
  const [resolvedPort] = useState(() => port ?? createBrowserCampaignDetailPort());
  const [resolvedContribution] = useState<CampaignContributionInjection>(() => ({
    onConnectWallet: () => router.push("/portfolio")
  }));

  return (
    <CampaignDetail
      campaignId={campaignId}
      role={role}
      port={resolvedPort}
      contribution={resolvedContribution}
    />
  );
}
