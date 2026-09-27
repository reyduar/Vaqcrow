import type { IconType } from "react-icons";
import {
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoCreateOutline,
  IoHourglassOutline
} from "react-icons/io5";
import { microcopy } from "@/application/trust/disclosures";

/**
 * TransactionStatusList (Issue #314 / T3): the "Estado de transacción" block
 * from `Vaqcrow Sistema.dc.html` (`docs/design/template/`, git-ignored) — an
 * ordered list that walks signed → sent (pending of confirmation) → confirmed,
 * carrying `aria-live="polite"` so assistive tech hears the list change as the
 * caller appends the terminal state. Presentational only: every value is a
 * prop, no network, no wallet, no arithmetic, no timestamp/hash derivation.
 *
 * Decoding of the template (recorded, not left implicit):
 * - The template's `<ol>` third item is drawn muted/dashed while it waits for
 *   Horizon ("Consultando Horizon cada 5 s…"), and the template then prints the
 *   real terminal outcomes in a separate chip grid ("Confirmada. Ledger …" /
 *   "Fallida. Saldo insuficiente"). This component folds those two chips into
 *   the list as the `confirmed` and `failed` states, because issue #314 fixes
 *   the list itself as signed → sent-pending → confirmed. A caller that has not
 *   yet seen confirmation simply omits the `confirmed` item; that absence is
 *   the pre-confirmation placeholder, and appending it is what `aria-live`
 *   announces.
 * - The template's `--ok-*`/`--warn-*`/`--err-*`/`--text2` tokens do not exist
 *   here. States map onto the real `--color-trust-*` tokens only:
 *   `signed` → neutral, `sent` → caution, `confirmed` → info, `failed` →
 *   critical. "Sent" therefore can never use a success colour: there is no
 *   success token, and the confirmed state's positive read is carried by its
 *   checkmark icon plus the visible "Confirmada en el ledger" text — never by
 *   colour alone (WCAG 2.2 AA).
 * - The state colour lives on the **surface and the icon only**, never on a
 *   text run. Measured over the state's own `/10` tint in light mode, the
 *   state colour as text reaches 4.38:1 (`caution`) and 4.50:1 (`info`) —
 *   below, or exactly on, the 4.5:1 AA floor for 13–14px text — and any
 *   reduced-opacity variant drops every state to 3.19–4.11:1. Text therefore
 *   inherits the page foreground (~16:1 over these tints) and the state reads
 *   from the tint, the border and the icon, exactly as `Timeline` does with
 *   its coloured dot and neutral text.
 * - The canonical pending sentence lives here, sourced from `microcopy`
 *   (`submittedNotConfirmed`); it is never a caller prop and is never retyped.
 *   The per-state labels below are ordinary UI microcopy (like `Timeline`'s
 *   "Completado"/"Paso actual"), not trust disclosures.
 *
 * `HashDisplay` is deliberately NOT composed here: the recommended API exposes
 * no transaction-hash prop, and the only hash-like value in the template's
 * markup is a caller-formatted account label inside `detail`. Composing
 * `HashDisplay` would add API surface this component never renders, so it was
 * left out rather than carried unused.
 */
export type TransactionStatusState = "signed" | "sent" | "confirmed" | "failed";

export interface TransactionStatusItem {
  readonly state: TransactionStatusState;
  /** Caller-formatted secondary line, e.g. "14:02:11 · cuenta GBX4…Q7LM". */
  readonly detail?: string;
}

const HEADING_TAGS = ["h2", "h3", "h4", "h5", "h6"] as const;
type HeadingTag = (typeof HEADING_TAGS)[number];

export interface TransactionStatusListProps {
  readonly items: readonly TransactionStatusItem[];
  /** Defaults to "Estado de transacción". */
  readonly heading?: string;
  /** Caller-formatted subtitle, e.g. "Aporte a la bóveda · Stellar Testnet". */
  readonly subtitle?: string;
  readonly headingLevel?: 2 | 3 | 4 | 5 | 6;
  readonly className?: string;
}

const STATE_LABEL: Readonly<Record<TransactionStatusState, string>> = {
  signed: "Firmada en Freighter",
  sent: "Enviada · pendiente de confirmación",
  confirmed: "Confirmada en el ledger",
  failed: "Fallida"
};

const STATE_ICON: Readonly<Record<TransactionStatusState, IconType>> = {
  signed: IoCreateOutline,
  sent: IoHourglassOutline,
  confirmed: IoCheckmarkCircleOutline,
  failed: IoCloseCircleOutline
};

/**
 * Per-state surface (border + tint). Carries no text colour on purpose — see
 * the module doc: the state colour is a surface and icon signal here, because
 * these near-white tints put a state-coloured text run under the AA floor.
 * `sent` uses caution and `confirmed` uses info; no state reaches for a
 * success token (none exists).
 */
const STATE_SURFACE_CLASS: Readonly<Record<TransactionStatusState, string>> = {
  signed: "border border-trust-neutral/30 bg-trust-neutral/10",
  sent: "border border-trust-caution/30 bg-trust-caution/10",
  confirmed: "border border-trust-info/30 bg-trust-info/10",
  failed: "border border-trust-critical/30 bg-trust-critical/10"
};

/** The state colour proper, applied to the decorative mark only. */
const STATE_ICON_CLASS: Readonly<Record<TransactionStatusState, string>> = {
  signed: "text-trust-neutral",
  sent: "text-trust-caution",
  confirmed: "text-trust-info",
  failed: "text-trust-critical"
};

export function TransactionStatusList({
  items,
  heading = "Estado de transacción",
  subtitle,
  headingLevel = 3,
  className
}: TransactionStatusListProps) {
  const HeadingTag: HeadingTag = HEADING_TAGS[headingLevel - 2] ?? "h3";

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border border-border p-6 ${className ?? ""}`.trim()}
    >
      <div>
        <HeadingTag className="m-0 text-lg leading-tight font-bold">{heading}</HeadingTag>
        {subtitle ? <div className="mt-0.5 text-[13px] text-muted">{subtitle}</div> : null}
      </div>

      <ol aria-live="polite" className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((item, index) => {
          const Icon = STATE_ICON[item.state];
          return (
            <li
              key={`${item.state}-${index}`}
              className={`flex gap-3 rounded-[10px] p-3 ${STATE_SURFACE_CLASS[item.state]}`}
            >
              <Icon
                aria-hidden="true"
                focusable="false"
                className={`mt-0.5 flex-shrink-0 text-[20px] ${STATE_ICON_CLASS[item.state]}`}
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold">{STATE_LABEL[item.state]}</div>
                {item.detail ? <div className="text-[13px]">{item.detail}</div> : null}
                {item.state === "sent" ? (
                  <div className="text-[13px]">{microcopy.submittedNotConfirmed}</div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
