import { panaderiaHorizonte } from "@/application/fixtures/panaderia-horizonte";
import { SalesEvidenceTable } from "@/presentation/components/sales-evidence-table";
import { SmeRequestWorkspace } from "@/presentation/components/sme-request-workspace";
import { StepPlaceholder } from "@/presentation/components/step-placeholder";
import { StepTrustDisclosures } from "@/presentation/components/step-trust-disclosures";
import { SyntheticValue } from "@/presentation/components/synthetic-value";

export default function RequestPage() {
  return (
    <>
      <StepTrustDisclosures step="request" />
      <section aria-label="Identidad y evidencia de la PyME solicitante" lang="es">
        <h2>Solicitud y evidencia de la PyME</h2>
        <SyntheticValue
          label="Empresa"
          value={panaderiaHorizonte.legalName}
          simuladoLabel={panaderiaHorizonte.simuladoLabel}
        />
        <SyntheticValue
          label="KYC"
          value={panaderiaHorizonte.kyc.status}
          simuladoLabel={panaderiaHorizonte.kyc.simuladoLabel}
        />
        <SalesEvidenceTable />
        <SmeRequestWorkspace />
      </section>
      <StepPlaceholder />
    </>
  );
}
