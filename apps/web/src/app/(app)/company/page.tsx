import { HelpAssistant } from "@/presentation/components/landing/help-assistant";
import { CompanyWorkspace } from "@/presentation/components/pyme-onboarding/company-workspace";

/**
 * «Mi campaña»: the PyME dashboard and, inside the same URL, the onboarding
 * wizard opened by «Registrar mi PyME» (#399 / T1) and the read-only «Ver lo
 * enviado» panel (#530). The register action shows only while the PyME has no
 * application; every other state offers «Ver lo enviado» instead (#530). No
 * route is invented, and the scripted journey routes stay retired (#438).
 * There is no connect-wallet popup (owner decision): Freighter is required at
 * the wizard's review step.
 *
 * The floating help assistant (#535) is mounted here so a signed-in PyME can
 * ask about the platform without leaving the page; it is the same client island
 * the landing mounts and reuses its chat.
 */
export default function CompanyPage() {
  return (
    <>
      <CompanyWorkspace />
      <HelpAssistant />
    </>
  );
}
