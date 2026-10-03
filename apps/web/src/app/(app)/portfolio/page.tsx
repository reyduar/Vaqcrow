import { ROLE_HOME_COPY } from "@/application/navigation/shell-nav";
import { PageHeading } from "@/presentation/components/page-heading";

/** «Mi portafolio» skeleton: the template's title and subtitle; the content is #426. */
export default function PortfolioPage() {
  return <PageHeading title={ROLE_HOME_COPY.INVERSOR.title} subtitle={ROLE_HOME_COPY.INVERSOR.subtitle} />;
}
