import { CompanyWorkspace } from "@/presentation/components/pyme-onboarding/company-workspace";

/**
 * «Mi campaña»: the PyME dashboard skeleton and, inside the same URL, the
 * onboarding wizard opened by «Registrar mi PyME» (#399 / T1). There is no
 * company registry yet, so the action always shows (the "only while no
 * registered company" rule is a later unit) and opens the wizard in place —
 * no route is invented, and the scripted journey routes stay retired (#438).
 * There is no connect-wallet popup (owner decision): Freighter is required at
 * the wizard's review step.
 */
export default function CompanyPage() {
  return <CompanyWorkspace />;
}
