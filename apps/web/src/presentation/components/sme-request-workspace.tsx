"use client";

import { useMemo } from "react";
import {
  backendPeriodsToEvidenced,
  buildReviewItems,
  demoReviewItems
} from "@/application/evidence/review-mapper";
import { SIMULADO_LABEL } from "@/application/fixtures/panaderia-horizonte";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { createSmeRequestGateway } from "@/infrastructure/sme/default-gateway";
import { useSmeRequest } from "@/state/use-sme-request";
import { EvidenceReviewPanel } from "./evidence-review-panel";
import { SmeRequestForm } from "./sme-request-form";

/**
 * ASSUMPTION: placeholder reference for the synthetic SME while no backend
 * assigns one; it is a fixture label, not real identity data.
 */
export const DEMO_SME_REFERENCE = "sme:SYN-PH-0001";

const defaultGateway = createSmeRequestGateway(process.env["NEXT_PUBLIC_API_BASE_URL"]);

export interface SmeRequestWorkspaceProps {
  /** Injectable for tests; `undefined` uses the env-configured gateway, `null` forces fixtures only. */
  readonly gateway?: SmeRequestGateway | null;
}

/**
 * Small client container: wires the SME request form and the evidence review
 * panel to server state. Starts from (and falls back to) the synthetic
 * fixtures, so the page renders and never invents data without a backend.
 */
export function SmeRequestWorkspace({ gateway = defaultGateway }: SmeRequestWorkspaceProps) {
  const { current, loadFailed, submit, isSubmitting, submitError, submitted } = useSmeRequest(
    gateway,
    DEMO_SME_REFERENCE
  );

  const items = useMemo(
    () =>
      current ? buildReviewItems(current.request, backendPeriodsToEvidenced(current.salesPeriods)) : demoReviewItems,
    [current]
  );

  return (
    <div lang="es" className="flex flex-col gap-6">
      <SmeRequestForm
        simuladoLabel={SIMULADO_LABEL}
        onSubmit={submit}
        {...(submitError ? { submitError } : {})}
        isSubmitting={isSubmitting}
      />
      {submitted ? <p role="status">Solicitud registrada en el entorno de demostración (SIMULADO).</p> : null}
      {loadFailed ? (
        <p role="alert">
          No se pudo cargar el historial de ventas. Se muestran datos sintéticos de ejemplo, no los del servicio.
        </p>
      ) : null}
      <EvidenceReviewPanel findings={items} simuladoLabel={SIMULADO_LABEL} />
    </div>
  );
}
