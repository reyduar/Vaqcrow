import { disclosures, type DisclosureId } from "@/application/trust/disclosures";
import { TrustBanner } from "./trust-banner";

/**
 * CanonicalDisclosure (Feature #17 / Task #53): the ONLY render path for the
 * five canonical DEMO.md §12 disclosure texts. No other component may inline
 * this copy — every route renders one of these five texts by importing this
 * component with a `disclosureId`, never by writing the sentence itself.
 */
export interface CanonicalDisclosureProps {
  readonly id: DisclosureId;
  readonly lang?: "es" | "en";
}

export function CanonicalDisclosure({ id, lang = "es" }: CanonicalDisclosureProps) {
  const disclosure = disclosures[id];

  return <TrustBanner variant={disclosure.banner} title={disclosure.title} body={disclosure.text} lang={lang} />;
}
