"use client";

import { microcopy } from "@/application/trust/disclosures";
import type { AssessmentGateway } from "@/application/ports/assessment-gateway";
import { createAssessmentGateway } from "@/infrastructure/assessment/default-gateway";
import { useJourneyStore } from "@/state/journey-store-provider";
import { useAssessment } from "@/state/use-assessment";
import { AiAssessmentPanel } from "./ai-assessment-panel";
import { Button } from "./button";
import { StartWithRequestNotice } from "./start-with-request-notice";
import { TrustBanner } from "./trust-banner";

/**
 * The assessment step: ask the backend to assess the journey's application, and
 * show what came back.
 *
 * The evidence is never sent from here: the backend derives it from the
 * persisted request and its (synthetic, labelled `SIMULADO`) sales history,
 * while the assessment itself is real. That asymmetry is the point: `DEMO.md`
 * §4 marks the risk evaluation **Real** and the sales feed simulated, and this
 * screen must not blur the two. Without a submitted request there is nothing to
 * assess, so the step says so and calls nothing.
 *
 * Every outcome is said as it happened. A recorded assessment moves the
 * application to human review. When the provider times out, breaks, or answers
 * something inadmissible, the application also goes to human review — but
 * WITHOUT an assessment, and the screen says exactly that instead of falling
 * back to a canned evaluation that would look like a result. A request with no
 * sales history evaluated nothing and changed nothing.
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
  not_found: "No se encontró la solicitud en el backend.",
  state_conflict: "La solicitud ya no está esperando evaluación.",
  correlation_conflict: "Ya existe otro intento de evaluación registrado para esta solicitud.",
  unavailable: "La consulta falló."
};

export function AssessmentWorkspace({ gateway = defaultGateway }: { readonly gateway?: AssessmentGateway | null }) {
  const applicationId = useJourneyStore((state) => state.applicationId);
  const { state, request } = useAssessment(gateway, applicationId);

  return (
    <div className="flex flex-col gap-6">
      {applicationId === null ? (
        <StartWithRequestNotice action="consultar la evaluación" />
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-border p-6">
          <Button
            type="button"
            isDisabled={state.status === "loading"}
            onPress={() => {
              void request();
            }}
          >
            Consultar evaluación de IA
          </Button>
          <span className="text-sm text-text-secondary">
            La evaluación se pide al backend; la evidencia la toma el servidor de la solicitud enviada.
          </span>
        </div>
      )}

      {state.status === "loading" ? (
        <p role="status" className="m-0 text-sm text-text-secondary">
          Consultando al modelo…
        </p>
      ) : null}

      {state.status === "recorded" ? (
        <>
          <p role="status" className="m-0 text-sm">
            La evaluación quedó registrada y la solicitud pasó a revisión humana.
          </p>
          <AiAssessmentPanel assessment={state.view} />
        </>
      ) : null}

      {state.status === "manual_review" ? (
        <p role="alert" className="m-0 text-sm">
          {`${FAILURE_COPY[state.failureCode] ?? FAILURE_COPY["unavailable"]} La solicitud pasó a revisión humana sin una evaluación de IA: no hay ninguna evaluación que mostrar.`}
        </p>
      ) : null}

      {state.status === "no_sales_evidence" ? (
        <p role="alert" className="m-0 text-sm">
          La solicitud no tiene historial de ventas, así que no se evaluó nada. La solicitud sigue esperando la evaluación.
        </p>
      ) : null}

      {state.status === "failed" && state.code !== "no_application" ? (
        <p role="alert" className="m-0 text-sm">
          {`${FAILURE_COPY[state.code] ?? FAILURE_COPY["unavailable"]} No hay evaluación que mostrar.`}
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

      {applicationId !== null && state.status === "idle" ? (
        <p className="m-0 text-sm text-text-secondary">Todavía no se consultó ninguna evaluación.</p>
      ) : null}
    </div>
  );
}
