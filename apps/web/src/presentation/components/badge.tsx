import type { IconType } from "react-icons";

/**
 * Badge primitive (Feature #17 / Task #53). Every instance renders visible
 * text — `label` is required — so meaning never lives only in an icon or a
 * color. `BadgeTone` deliberately has no "success" member: a transaction in
 * "Enviada"/"Pendiente de confirmación" must never be able to read as
 * success at the type level, not only by convention.
 */
export type BadgeVariant =
  | "simulado"
  | "testnet"
  | "demo"
  | "risk"
  | "transaction"
  | "evidence"
  | "fallback";

export type BadgeTone = "neutral" | "info" | "caution" | "critical";

export interface BadgeProps {
  readonly variant: BadgeVariant;
  /** Required visible text; meaning lives here, never in icon/color alone. */
  readonly label: string;
  readonly tone?: BadgeTone;
  /** react-icons/io5 icon only, always rendered aria-hidden. */
  readonly icon?: IconType;
  readonly lang?: "es" | "en";
}

const DEFAULT_TONE: Readonly<Record<BadgeVariant, BadgeTone>> = {
  simulado: "caution",
  risk: "caution",
  fallback: "caution",
  testnet: "info",
  demo: "info",
  transaction: "neutral",
  evidence: "neutral"
};

const TONE_CLASSES: Readonly<Record<BadgeTone, string>> = {
  neutral: "bg-trust-neutral/10 text-trust-neutral border-trust-neutral/30",
  info: "bg-trust-info/10 text-trust-info border-trust-info/30",
  caution: "bg-trust-caution/10 text-trust-caution border-trust-caution/30",
  critical: "bg-trust-critical/10 text-trust-critical border-trust-critical/30"
};

export function Badge({ variant, label, tone, icon: Icon, lang }: BadgeProps) {
  const resolvedTone = tone ?? DEFAULT_TONE[variant];

  return (
    <span
      data-variant={variant}
      data-tone={resolvedTone}
      lang={lang}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[resolvedTone]}`}
    >
      {Icon ? <Icon aria-hidden="true" focusable="false" /> : null}
      {label}
    </span>
  );
}
