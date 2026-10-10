import type { ReactNode } from "react";
import { IoOpenOutline } from "react-icons/io5";
import { truncateMiddle } from "./hash-display";

/**
 * ExplorerProof (#438 WU5): the template's compact contract row from the
 * «Revisión antes de firmar» dialog (`Vaqcrow Sistema.dc.html`: «CDLZ…7Q4K
 * Explorador», mono truncated value + an `open-outline` link whose
 * `aria-label` names the full value, after the visible link text). Extracted from the admin evidence chain
 * (WU4) so investors, PyMEs and campaign visitors read their Testnet proof the
 * same way.
 *
 * Presentational only: the API supplies `explorerUrl` (the web never knows the
 * network nor builds a link). A `null` URL renders the hash without a link; a
 * `null` value renders «Sin dato» (or the caller's `missing` node), never a
 * zero or an invented hash.
 */

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export const EXPLORER_LINK_TEXT = "Ver en el explorador";
export const SIN_DATO = "Sin dato";

export interface ExplorerProofProps {
  /** What the value is, e.g. «Hash de la transacción» or «Bóveda». */
  readonly label: string;
  /** Hide the visible label when a surrounding term (a `dt`, a heading) already names the value. */
  readonly hideLabel?: boolean;
  readonly value: string | null;
  /**
   * The visible short form when the caller follows a different rule than the
   * hash's middle truncation — e.g. the template's 4…4 contract address
   * («CDLZ…7Q4K»). The full `value` stays on `title` and for assistive tech.
   */
  readonly displayValue?: string;
  readonly explorerUrl: string | null;
  /** Visible link text; defaults to «Ver en el explorador». */
  readonly linkText?: string;
  /** What the link proves, for its accessible name; defaults to `label`. */
  readonly proofLabel?: string;
  /** Rendered instead of «Sin dato» when `value` is `null`. */
  readonly missing?: ReactNode;
  readonly className?: string;
}

function lowerFirst(text: string): string {
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

/**
 * The link's accessible name. It starts with the visible link text, contiguous
 * (WCAG 2.5.3 Label in Name, the same rule as `HashDisplay`), then says what it
 * proves, the full value, and that it opens a new tab — e.g. «Ver en el
 * explorador: hash del aporte 9c4e… (abre en una pestaña nueva)».
 */
export function explorerLinkName(linkText: string, proofLabel: string, value: string): string {
  return `${linkText}: ${lowerFirst(proofLabel)} ${value} (abre en una pestaña nueva)`;
}

export function ExplorerProof({
  label,
  hideLabel = false,
  value,
  displayValue,
  explorerUrl,
  linkText = EXPLORER_LINK_TEXT,
  proofLabel,
  missing,
  className
}: ExplorerProofProps) {
  const labelNode = hideLabel ? null : <span className="text-sm text-text-secondary">{label}</span>;
  const rowClass = `flex flex-wrap items-center gap-x-3 gap-y-1 ${className ?? ""}`.trim();

  if (value === null) {
    return (
      <div className={rowClass}>
        {labelNode}
        {missing ?? <span className="text-sm">{SIN_DATO}</span>}
      </div>
    );
  }

  const short = displayValue ?? truncateMiddle(value);
  return (
    <div className={rowClass}>
      {labelNode}
      <span title={value} className="min-w-0 font-mono text-[13px] break-all">
        <span aria-hidden="true">{short}</span>
        <span className="sr-only">{value}</span>
      </span>
      {explorerUrl === null ? null : (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={explorerLinkName(linkText, proofLabel ?? label, value)}
          className={`inline-flex items-center gap-1 rounded text-[13px] font-semibold text-brand-accent-text ${FOCUS_RING}`}
        >
          {linkText}
          <IoOpenOutline aria-hidden="true" focusable="false" className="text-[15px]" />
        </a>
      )}
    </div>
  );
}
