"use client";

import { useState } from "react";
import { toAssessmentEvidence } from "@/application/assessment/assessment-evidence";
import { panaderiaHorizonte } from "@/application/fixtures/panaderia-horizonte";
import { microcopy } from "@/application/trust/disclosures";
import type { AssessmentGateway } from "@/application/ports/assessment-gateway";
import { createAssessmentGateway } from "@/infrastructure/assessment/default-gateway";
import { useAssessment } from "@/state/use-assessment";
import { AiAssessmentPanel } from "./ai-assessment-panel";
import { TrustBanner } from "./trust-banner";

/**
 * The assessment step: ask the backend for a real evaluation of the synthetic
 * sales history, and show what came back.
 *
 * The evidence is the demo's frozen Panadería Horizonte history — synthetic and
 * labelled `SIMULADO` — while the assessment itself is real. That asymmetry is
 * the point: `DEMO.md` §4 marks the risk evaluation **Real** and the sales feed
 * simulated, and this screen must not blur the two.
 *
 * A failure is never dressed as an assessment. When the provider times out,
 * breaks, or answers something inadmissible, the screen says so, keeps the
 * fallback banner, and leaves the decision to a person — it does not fall back
 * to a canned evaluation that would look like a result.
 */

const defaultGateway = createAssessmentGateway(process.env["NEXT_PUBLIC_API_BASE_URL"]);

const FAILURE_COPY: Readonly<Record<string, string>> = {
  not_configured: "No hay backend configurado, así que no se puede consultar una evaluación real.",
  timeout: "El proveedor no respondió a tiempo.",
  provider_unavailable: "El proveedor no está disponible.",
  invalid_output: "El proveedor respondió, pero su respuesta no cumple el contrato de evaluación.",
  unknown_evidence_reference:
    "El proveedor citó evidencia que no se le entregó, así que su respuesta se descartó.",
  invalid_response: "La respuesta del backend no tiene la forma que esta pantalla puede mostrar.",
  unavailable: "La consulta falló."
};

export function AssessmentWorkspace({ gateway = defaultGateway }: { readonly gateway?: AssessmentGateway | null }) {
  const { state, request } = useAssessment(gateway);
  const [requested, setRequested] = useState(false);

  const evidence = toAssessmentEvidence(panaderiaHorizonte.sales);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded border px-3 py-2"
          disabled={state.status === "loading"}
          onClick={() => {
            setRequested(true);
            void request(evidence);
          }}
        >
          Consultar evaluación de IA
        </button>
        <span className="text-sm text-muted">
          La evaluación se pide al backend; la evidencia es la serie sintética de la demo.
        </span>
      </div>

      {state.status === "loading" ? (
        <p role="status" className="text-sm text-muted">
          Consultando al modelo…
        </p>
      ) : null}

      {state.status === "ready" ? <AiAssessmentPanel assessment={state.view} /> : null}

      {state.status === "failed" ? (
        <p role="alert" className="text-sm">
          {`${FAILURE_COPY[state.code] ?? FAILURE_COPY["unavailable"]} No hay evaluación que mostrar: este caso requiere revisión humana.`}
        </p>
      ) : null}

      {/*
        The fallback disclosure is standing, not conditional: Feature #17 requires
        this route to state what happens when the AI is unavailable, and that
        policy is true whether or not a failure is happening right now. The alert
        above is what says a failure is happening.
      */}
      <TrustBanner
        variant="fallback"
        title="Respuesta de respaldo"
        body={microcopy.aiFallback}
        badge={{ variant: "fallback", label: "RESPUESTA DE RESPALDO" }}
        lang="es"
      />

      {!requested && state.status === "idle" ? (
        <p className="text-sm text-muted">
          Todavía no se consultó ninguna evaluación.
        </p>
      ) : null}
    </div>
  );
}
