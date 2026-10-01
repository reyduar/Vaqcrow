import { CanonicalDisclosure } from "./canonical-disclosure";

/**
 * SiteFooter (Issue #318 / T1): the compact footer from `Vaqcrow Onboarding
 * PyME.dc.html` (`docs/design/template/`, git-ignored) — a top border, the
 * canonical "No apto para producción" notice and a muted legal row.
 * Presentational only: no network, no storage, no state.
 *
 * Decoding of the template (recorded, not left implicit):
 * - **The notice is canonical and never retyped.** It renders the
 *   `no-production` entry of `application/trust/disclosures.ts` through
 *   `CanonicalDisclosure` — the module's documented only render path for that
 *   copy, and the pattern `CustodyNote` already follows. It is not a caller
 *   prop. Deviation: `CanonicalDisclosure` owns its own presentation (a
 *   `TrustBanner`/HeroUI `Alert` with `role="note"`), so the template's
 *   bespoke rounded `var(--canvas)` box is not re-created here; re-implementing
 *   that box would mean duplicating banner markup the shared renderer already
 *   owns. The footer itself carries the muted surface (`bg-surface`) and the
 *   `border-t`.
 * - **The legal row is caller-supplied.** The template's second slot reads
 *   `Stellar Testnet · Activos sin valor económico`, which is NOT canonical:
 *   `microcopy.testnetBadge` reads `TESTNET · Activos sin valor económico`.
 *   Treating the template string as copy would invent wording, so both slots
 *   are plain caller strings — the story passes the canonical
 *   `microcopy.testnetBadge`, and neither string is hardcoded here. The row is
 *   omitted entirely when the caller supplies neither.
 * - **Tokens.** `--border` → HeroUI `border-border`; `--surface` → HeroUI
 *   `bg-surface`; `--text2` → `text-text-secondary`. The template's other
 *   tokens (`--control`, `--raised`, `--accent-*`, `--logo`, the status
 *   surfaces) exist as app tokens since Slice 2/3 but are not needed by this
 *   footer. The template's bold lead sentence is owned by the canonical
 *   disclosure's own title; it is never split or retyped.
 */
export interface SiteFooterProps {
  /** Left legal line, e.g. "Vaqcrow · 2026". */
  readonly copyright?: string;
  /** Right legal line. The story passes the canonical `microcopy.testnetBadge`. */
  readonly environment?: string;
  readonly className?: string;
}

export function SiteFooter({ copyright, environment, className }: SiteFooterProps) {
  const hasLegalRow = Boolean(copyright) || Boolean(environment);

  return (
    <footer className={`border-t border-border bg-surface ${className ?? ""}`.trim()}>
      {/* Template footer geometry (`Vaqcrow Sistema.dc.html` lines 416–428):
          48 px vertical padding, 32 px lateral, and a bordered legal row. The
          template's own nav links are omitted on purpose — the seven-page MVP
          has no routes for them, and dead links would be invented product
          scope (see the plan's Out of scope). */}
      <div className="mx-auto flex max-w-[1264px] flex-col gap-5 px-8 py-12">
        <CanonicalDisclosure id="no-production" />
        {hasLegalRow ? (
          <div className="flex flex-wrap justify-between gap-4 border-t border-border pt-6 text-xs text-text-secondary">
            {copyright ? <span>{copyright}</span> : null}
            {environment ? <span>{environment}</span> : null}
          </div>
        ) : null}
      </div>
    </footer>
  );
}
