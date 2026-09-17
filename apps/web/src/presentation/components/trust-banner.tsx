import { Alert } from "@heroui/react";
import type { IconType } from "react-icons";
import { IoAlertCircleOutline, IoInformationCircleOutline, IoWarningOutline } from "react-icons/io5";
import type { DisclosureBannerVariant } from "@/application/trust/disclosures";
import { Badge, type BadgeProps } from "./badge";

/**
 * TrustBanner compound (Feature #17 / Task #53): wraps HeroUI's `Alert`
 * compound (`Alert.Root`/`Indicator`/`Content`/`Title`/`Description`) so
 * disclosure banners are accessible HeroUI primitives — icon + title + full
 * disclosure body + optional badge/link. `TrustBannerVariant` aliases the
 * canonical `DisclosureBannerVariant` declared in
 * `application/trust/disclosures.ts` — that module owns the single
 * definition; this file only reuses it so the identity and the visual
 * variant of a disclosure stay declared once.
 *
 * HeroUI's `Alert.Root` never assigns an ARIA `role` itself (it only
 * forwards unrecognized props onto its wrapper `<div>`), so this component
 * still sets `role="note"`/`role="alert"` explicitly per variant — that
 * semantic is a project requirement, not something HeroUI's `status` prop
 * implies.
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

/**
 * `TrustBannerVariant` → HeroUI `Alert` `status`. No disclosure variant is a
 * success state, so this never selects HeroUI's own `"success"` status.
 */
const STATUS_BY_VARIANT: Readonly<Record<TrustBannerVariant, "accent" | "warning" | "danger">> = {
  simulation: "accent",
  testnet: "accent",
  fallback: "warning",
  error: "danger"
};

export function TrustBanner({ variant, title, body, badge, link, lang }: TrustBannerProps) {
  const Icon = ICON_BY_VARIANT[variant];

  return (
    <Alert.Root
      status={STATUS_BY_VARIANT[variant]}
      role={ROLE_BY_VARIANT[variant]}
      lang={lang}
      data-variant={variant}
    >
      <Alert.Indicator>
        <Icon aria-hidden="true" focusable="false" />
      </Alert.Indicator>
      <Alert.Content>
        <header className="flex items-center gap-2">
          <Alert.Title>{title}</Alert.Title>
          {badge ? <Badge {...badge} /> : null}
        </header>
        <Alert.Description>{body}</Alert.Description>
        {link ? <a href={link.href}>{link.label}</a> : null}
      </Alert.Content>
    </Alert.Root>
  );
}
