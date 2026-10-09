"use client";

import Link from "next/link";
import { useState } from "react";
import { IoLockClosedOutline } from "react-icons/io5";
import type { CampaignDetailPort } from "@/application/ports/campaign-detail-port";
import { createBrowserCampaignDetailPort } from "@/infrastructure/campaign/create-campaign-detail-port";
import { useSession } from "@/state/session-store-provider";
import { useCampaignDetail } from "@/state/use-campaign-detail";
import { ErrorState } from "../error-state";
import { Skeleton } from "../skeleton";
import { CampaignDetailView } from "./campaign-detail-view";

/**
 * Campaign detail controller (Feature #422, WU2). The route is public but the
 * detail is account-gated: a signed-out visitor sees the template's gate card
 * ("Ingresá para ver esta campaña") and **nothing is fetched**. With a session
 * the controller owns the four remaining states — loading, error+retry, 404 and
 * the detail — driven only by `useCampaignDetail`, never by locally invented
 * data.
 *
 * `signedIn` is a prop (the container reads the session) so the whole state
 * machine is exercisable without a session provider.
 */

export interface CampaignDetailProps {
  readonly campaignId: string;
  readonly signedIn: boolean;
  /** Injectable for tests; `null`/omitted forces "no backend". */
  readonly port?: CampaignDetailPort | null;
}

/** The template's logged-out gate (`Vaqcrow Detalle PyME.dc.html` lines 91–102). */
export function CampaignDetailGate() {
  return (
    <div className="mx-auto mt-8 flex w-full max-w-[560px] flex-col items-center gap-4 rounded-card border border-border px-8 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-pill bg-brand-accent-tint text-brand-accent-text">
        <IoLockClosedOutline aria-hidden="true" focusable="false" className="text-[26px]" />
      </span>
      <h1 className="m-0 text-[30px] leading-tight font-bold tracking-[-0.02em]">Ingresá para ver esta campaña</h1>
      <p className="m-0 max-w-[44ch] text-base text-pretty text-text-secondary">
        El detalle de cada campaña está disponible para cuentas registradas. En esta demo, elegí con qué tipo de cuenta
        querés ingresar.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link
          href="/login"
          className="inline-flex h-12 items-center rounded-control bg-brand-accent px-[18px] text-[15px] font-semibold text-on-accent hover:bg-brand-accent-hover"
        >
          Ingresar como inversor
        </Link>
        <Link
          href="/login"
          className="inline-flex h-12 items-center rounded-control border border-control px-[18px] text-[15px] font-semibold text-text-primary hover:bg-page-surface"
        >
          Ingresar como PyME
        </Link>
      </div>
      <p className="m-0 mt-1 text-sm text-text-secondary">
        ¿No tenés cuenta?{" "}
        <Link href="/signup" className="font-semibold text-brand-accent-text underline underline-offset-[3px]">
          Creá una
        </Link>
      </p>
    </div>
  );
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

export function CampaignDetail({ campaignId, signedIn, port }: CampaignDetailProps) {
  // Captured once: an omitted prop stays null, so a test's injected port is
  // never re-created and the browser port is created only by the container.
  const [resolvedPort] = useState<CampaignDetailPort | null>(() => port ?? null);
  const state = useCampaignDetail(campaignId, resolvedPort, signedIn);

  if (!signedIn) return <CampaignDetailGate />;
  if (state.isLoading) return <Skeleton shapes={["card", "line", "line"]} label="Cargando campaña" />;
  if (state.notFound) return <CampaignDetailNotFound />;
  if (state.loadFailed || state.detail === null) {
    return (
      <ErrorState
        title="No pudimos cargar la campaña"
        message="El servicio no respondió. Ningún dato ni aporte se modificó."
        onRetry={state.reload}
        retryLabel="Reintentar"
      />
    );
  }
  return <CampaignDetailView detail={state.detail} />;
}

/**
 * Browser-wired entry point. It reads the session and injects the browser port;
 * `null`/omitted `port` means the browser default, so tests can inject a fake.
 */
export function CampaignDetailContainer({
  campaignId,
  port
}: {
  readonly campaignId: string;
  readonly port?: CampaignDetailPort | null;
}) {
  const signedIn = useSession((state) => state.status === "signed-in");
  const [resolvedPort] = useState(() => port ?? createBrowserCampaignDetailPort());

  return <CampaignDetail campaignId={campaignId} signedIn={signedIn} port={resolvedPort} />;
}
