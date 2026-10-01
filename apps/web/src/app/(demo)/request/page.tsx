import { panaderiaHorizonte } from "@/application/fixtures/panaderia-horizonte";
import { SalesEvidenceTable } from "@/presentation/components/sales-evidence-table";
import { SmeRequestWorkspace } from "@/presentation/components/sme-request-workspace";
import { StepTrustDisclosures } from "@/presentation/components/step-trust-disclosures";
import { SyntheticValue } from "@/presentation/components/synthetic-value";

/**
 * Request step. The identity summary is a labelled `<dl>` and the sales series
 * a card, both at the template's card geometry (`Vaqcrow Sistema.dc.html`
 * "Compuestos": `padding:24px;border:1px solid var(--border);border-radius:16px`).
 */
export default function RequestPage() {
  return (
    <>
      <StepTrustDisclosures step="request" />
      <section
        aria-label="Identidad y evidencia de la PyME solicitante"
        lang="es"
        className="flex flex-col gap-6"
      >
        <h2 className="m-0 text-xl font-bold tracking-[-0.02em]">Solicitud y evidencia de la PyME</h2>

        <dl className="m-0 grid gap-4 rounded-card border border-border p-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <dt className="text-xs font-medium text-text-secondary">Empresa</dt>
            <dd className="m-0">
              <SyntheticValue
                value={panaderiaHorizonte.legalName}
                simuladoLabel={panaderiaHorizonte.simuladoLabel}
              />
            </dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <dt className="text-xs font-medium text-text-secondary">KYC</dt>
            <dd className="m-0">
              <SyntheticValue
                value={panaderiaHorizonte.kyc.status}
                simuladoLabel={panaderiaHorizonte.kyc.simuladoLabel}
              />
            </dd>
          </div>
        </dl>

        <div className="rounded-card border border-border p-6">
          <SalesEvidenceTable />
        </div>

        <SmeRequestWorkspace />
      </section>
    </>
  );
}
