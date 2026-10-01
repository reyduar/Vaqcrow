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

/**
 * Per-variant surface from `Vaqcrow Sistema.dc.html` §05 (lines 271–286):
 * simulation is a dashed `--control` outline, testnet an `--accent-tint`
 * fill, fallback an `--info-s` fill, error an `--err-s` fill — all at the
 * card radius (16 px). The classes are utilities, so they outrank HeroUI's
 * own `Alert` status colours.
 */
const SURFACE_BY_VARIANT: Readonly<Record<TrustBannerVariant, string>> = {
  simulation: "rounded-card border border-dashed border-control bg-transparent text-text-primary",
  testnet: "rounded-card border-transparent bg-brand-accent-tint text-text-primary",
  fallback: "rounded-card border-transparent bg-trust-info-surface text-trust-info",
  error: "rounded-card border-transparent bg-trust-critical-surface text-trust-critical"
};

/** Icon colour per variant; testnet reads its accent from the accent-text token. */
const ICON_CLASS_BY_VARIANT: Readonly<Record<TrustBannerVariant, string>> = {
  simulation: "text-text-secondary",
  testnet: "text-brand-accent-text",
  fallback: "text-trust-info",
  error: "text-trust-critical"
};

export function TrustBanner({ variant, title, body, badge, link, lang }: TrustBannerProps) {
  const Icon = ICON_BY_VARIANT[variant];

  return (
    <Alert.Root
      status={STATUS_BY_VARIANT[variant]}
      role={ROLE_BY_VARIANT[variant]}
      lang={lang}
      data-variant={variant}
      className={SURFACE_BY_VARIANT[variant]}
    >
      <Alert.Indicator className={ICON_CLASS_BY_VARIANT[variant]}>
        <Icon aria-hidden="true" focusable="false" />
      </Alert.Indicator>
      <Alert.Content>
        <header className="flex items-center gap-2">
          <Alert.Title className="font-semibold">{title}</Alert.Title>
          {badge ? <Badge {...badge} /> : null}
        </header>
        <Alert.Description className="text-inherit">{body}</Alert.Description>
        {link ? <a href={link.href}>{link.label}</a> : null}
      </Alert.Content>
    </Alert.Root>
  );
}
