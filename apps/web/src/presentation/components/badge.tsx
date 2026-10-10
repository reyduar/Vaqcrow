import { Chip } from "@heroui/react";
import type { IconType } from "react-icons";

/**
 * Badge primitive (Feature #17 / Task #53). Wraps HeroUI's `Chip` so trust
 * badges are accessible HeroUI primitives, not plain `<span>` markup, while
 * keeping the project's own `--color-trust-*` Tailwind tokens as the visual
 * source of truth via `className`. Every instance renders visible text —
 * `label` is required — so meaning never lives only in an icon or a color.
 *
 * Slice 3 fidelity pass (template `Vaqcrow Sistema.dc.html` §04 "Badges",
 * lines 199–207): the pill is 24 px high, 10 px inline padding, radius 999,
 * 12 px / 600 type. The signature chips use the template's own treatments —
 * `DEMO` is outlined, `SIMULADO` a dashed outline, `TESTNET` an accent tint —
 * while risk/transaction/evidence/fallback keep a semantic tone.
 *
 * `size="compact"` is the template's header chip (`Vaqcrow Landing.dc.html`
 * header, the `DEMO`/`TESTNET` pair): 22 px high, 8 px inline padding,
 * 11 px type and a 13 px icon. The sticky header uses it; everything else
 * keeps the 24 px badge.
 *
 * The `success` tone is adopted from the template (`--ok-s`/`--ok-t`,
 * "Confirmada"), but `demo-ui.md` §2 bounds it: green is reserved for
 * outcomes **actually confirmed in the ledger**, never for
 * `Enviado`/`Pendiente de confirmación`, and never the only signal. That is
 * why `DEFAULT_TONE` still resolves every variant to a non-success tone, and
 * a caller must opt into `success` explicitly for a confirmed ledger result.
 */
export type BadgeVariant =
  | "simulado"
  | "testnet"
  | "demo"
  | "risk"
  | "transaction"
  | "evidence"
  | "fallback";

export type BadgeTone = "neutral" | "info" | "caution" | "critical" | "success";

export interface BadgeProps {
  readonly variant: BadgeVariant;
  /** Required visible text; meaning lives here, never in icon/color alone. */
  readonly label: string;
  readonly tone?: BadgeTone;
  /** react-icons/io5 icon only, always rendered aria-hidden. */
  readonly icon?: IconType;
  readonly lang?: "es" | "en";
  /** `compact` is the template's 22 px header chip; `default` the 24 px badge. */
  readonly size?: "default" | "compact";
}

const SIZE_CLASSES: Readonly<Record<"default" | "compact", { readonly pill: string; readonly icon: string }>> = {
  default: { pill: "h-6 px-2.5 text-xs", icon: "text-[14px]" },
  compact: { pill: "h-[22px] px-2 text-[11px]", icon: "text-[13px]" }
};

const DEFAULT_TONE: Readonly<Record<BadgeVariant, BadgeTone>> = {
  simulado: "caution",
  risk: "caution",
  fallback: "caution",
  testnet: "info",
  demo: "info",
  transaction: "neutral",
  evidence: "neutral"
};

/**
 * Semantic tone → the template's solid surface/text pair
 * (`Vaqcrow Sistema.dc.html` lines 15–16, `demo-ui.md` §5.4). `neutral` keeps
 * the template's outlined treatment (border + secondary text, no fill).
 */
const TONE_CLASSES: Readonly<Record<BadgeTone, string>> = {
  neutral: "border-border bg-transparent text-text-secondary",
  info: "border-transparent bg-trust-info-surface text-trust-info",
  caution: "border-transparent bg-trust-caution-surface text-trust-caution",
  critical: "border-transparent bg-trust-critical-surface text-trust-critical",
  success: "border-transparent bg-trust-success-surface text-trust-success"
};

/**
 * Variant-specific treatments that a tone cannot express, straight from the
 * template's badge row (`Vaqcrow Sistema.dc.html` lines 199–201, 207).
 */
const VARIANT_CLASSES: Partial<Readonly<Record<BadgeVariant, string>>> = {
  demo: "border-text-primary bg-transparent text-text-primary tracking-[0.06em]",
  simulado: "border-dashed border-text-secondary bg-transparent text-text-primary tracking-[0.04em]",
  testnet: "border-transparent bg-brand-accent-tint text-brand-accent-text tracking-[0.04em]"
};

/**
 * `BadgeTone` → HeroUI `Chip` `color`. The project's own `TONE_CLASSES` are
 * what actually render (utilities outrank HeroUI's components layer); this
 * mapping only keeps HeroUI's own derived states coherent.
 */
const TONE_TO_CHIP_COLOR: Readonly<
  Record<BadgeTone, "default" | "accent" | "warning" | "danger" | "success">
> = {
  neutral: "default",
  info: "accent",
  caution: "warning",
  critical: "danger",
  success: "success"
};

export function Badge({ variant, label, tone, icon: Icon, lang, size = "default" }: BadgeProps) {
  const resolvedTone = tone ?? DEFAULT_TONE[variant];
  const visualClasses = VARIANT_CLASSES[variant] ?? TONE_CLASSES[resolvedTone];
  const sizeClasses = SIZE_CLASSES[size];

  return (
    <Chip
      color={TONE_TO_CHIP_COLOR[resolvedTone]}
      variant="soft"
      size="sm"
      data-variant={variant}
      data-tone={resolvedTone}
      lang={lang}
      className={`inline-flex ${sizeClasses.pill} items-center gap-1 rounded-pill border font-semibold ${visualClasses}`}
    >
      {Icon ? <Icon aria-hidden="true" focusable="false" className={sizeClasses.icon} /> : null}
      {label}
    </Chip>
  );
}