import { IoStorefrontOutline } from "react-icons/io5";
import { ROLE_HOME_COPY } from "@/application/navigation/shell-nav";
import { PageHeading } from "@/presentation/components/page-heading";

const COPY = ROLE_HOME_COPY.PYME;

/**
 * «Mi campaña» skeleton: the template's title, subtitle and «Registrar mi
 * PyME» action; the content is #434. There is no company registry yet, so the
 * action always shows and has no destination: the registration wizard and its
 * route arrive with #398 (no route is invented here). There is no
 * connect-wallet popup (owner decision): Freighter is required at the
 * wizard's review step.
 */
export default function CompanyPage() {
  return (
    <PageHeading
      title={COPY.title}
      subtitle={COPY.subtitle}
      action={
        <button
          type="button"
          aria-disabled="true"
          className="inline-flex h-12 cursor-not-allowed items-center justify-center gap-2 rounded-control bg-brand-accent px-5 text-[15px] font-semibold whitespace-nowrap text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <IoStorefrontOutline aria-hidden="true" focusable="false" className="text-lg" />
          {COPY.registerCompany}
        </button>
      }
    />
  );
}
