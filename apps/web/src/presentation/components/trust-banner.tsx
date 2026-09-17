import type { IconType } from "react-icons";
import { IoAlertCircleOutline, IoInformationCircleOutline, IoWarningOutline } from "react-icons/io5";
import type { DisclosureBannerVariant } from "@/application/trust/disclosures";
import { Badge, type BadgeProps } from "./badge";

/**
 * TrustBanner compound (Feature #17 / Task #53): icon + title + full
 * disclosure body + optional badge/link. `TrustBannerVariant` aliases the
 * canonical `DisclosureBannerVariant` declared in
 * `application/trust/disclosures.ts` — that module owns the single
 * definition; this file only reuses it so the identity and the visual
 * variant of a disclosure stay declared once.
 */
export type TrustBannerVariant = DisclosureBannerVariant;

export interface TrustBannerProps {
  /** simulation | testnet | fallback render role="note"; error renders role="alert". */
  readonly variant: TrustBannerVariant;
  readonly title: string;
  /** Full disclosure text. Never truncate, clamp, or abbreviate this value. */
  readonly body: string;
  readonly badge?: BadgeProps;
  readonly link?: { readonly href: string; readonly label: string };
  readonly lang?: "es" | "en";
}

const ROLE_BY_VARIANT: Readonly<Record<TrustBannerVariant, "note" | "alert">> = {
  simulation: "note",
  testnet: "note",
  fallback: "note",
  error: "alert"
};

const ICON_BY_VARIANT: Readonly<Record<TrustBannerVariant, IconType>> = {
  simulation: IoInformationCircleOutline,
  testnet: IoInformationCircleOutline,
  fallback: IoWarningOutline,
  error: IoAlertCircleOutline
};

export function TrustBanner({ variant, title, body, badge, link, lang }: TrustBannerProps) {
  const Icon = ICON_BY_VARIANT[variant];

  return (
    <section role={ROLE_BY_VARIANT[variant]} lang={lang} data-variant={variant}>
      <header className="flex items-center gap-2">
        <Icon aria-hidden="true" focusable="false" />
        <h3>{title}</h3>
        {badge ? <Badge {...badge} /> : null}
      </header>
      <p>{body}</p>
      {link ? <a href={link.href}>{link.label}</a> : null}
    </section>
  );
}
