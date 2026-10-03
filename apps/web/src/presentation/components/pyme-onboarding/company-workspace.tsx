"use client";

import { useState } from "react";
import { IoStorefrontOutline } from "react-icons/io5";
import { ROLE_HOME_COPY } from "@/application/navigation/shell-nav";
import type { KycPort } from "@/application/ports/kyc-port";
import type { UploadPort } from "@/application/ports/upload-port";
import { SimulatedKycAdapter } from "@/infrastructure/kyc/simulated-kyc-adapter";
import { createBrowserUploadPort } from "@/infrastructure/upload/create-upload-port";
import { FOCUS_RING } from "../auth-field";
import { PageHeading } from "../page-heading";
import { PymeOnboardingWizard } from "./pyme-onboarding-wizard";

const COPY = ROLE_HOME_COPY.PYME;
const defaultKyc: KycPort = new SimulatedKycAdapter();

export interface CompanyWorkspaceProps {
  /** Injectable for tests; production uses the simulated KYC adapter. */
  readonly kyc?: KycPort;
  /** Injectable for tests; production builds the browser upload port lazily. */
  readonly upload?: UploadPort;
}

/**
 * `/company`: the PyME dashboard skeleton and the in-place onboarding wizard.
 *
 * «Registrar mi PyME» always shows today: the "only while the PyME has no
 * registered company" rule needs the company registry (#398's later unit) and
 * is intentionally not implemented here. Opening the wizard never changes the
 * URL — the wizard lives inside `/company` and «Volver» restores this view.
 */
export function CompanyWorkspace({ kyc = defaultKyc, upload }: CompanyWorkspaceProps) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [defaultUpload] = useState<UploadPort>(() => createBrowserUploadPort());
  const uploadPort = upload ?? defaultUpload;

  if (wizardOpen) {
    return <PymeOnboardingWizard kyc={kyc} upload={uploadPort} onBack={() => setWizardOpen(false)} />;
  }

  return (
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
  );
}
