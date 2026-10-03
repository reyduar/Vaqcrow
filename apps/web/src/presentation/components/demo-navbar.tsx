"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { IoCloseOutline, IoGitNetworkOutline, IoMenuOutline } from "react-icons/io5";
import { microcopy } from "@/application/trust/disclosures";
import { Badge } from "./badge";
import { BrandIsotipo } from "./brand-isotipo";

/**
 * DemoNavbar (Issue #318 / T1): the sticky header from `Vaqcrow Onboarding
 * PyME.dc.html` (`docs/design/template/`, git-ignored) — brand, `DEMO` and
 * `TESTNET` badges, and a primary navigation whose active item is marked
 * `aria-current="page"` plus a visible underline. Presentational only: labels,
 * hrefs and the active flag arrive as props; the only internal state is the
 * small-screen disclosure.
 *
 * Decoding of the template (recorded, not left implicit):
 * - **Logo.** The template masks `assets/vaqcrow-isotipo.png` (33 × 32 px)
 *   with the `--logo` colour next to the wordmark; `BrandIsotipo` does the
 *   same with `apps/web/public/vaqcrow-isotipo.png` and `bg-logo` (purple on
 *   light, white on dark), decorative inside the named brand link.
 * - **One-line nav (`singleLineNav`).** As in the template
 *   (`flex-wrap:nowrap; overflow-x:auto`), the role-aware header's nav never
 *   wraps its items from the `@md` width up: it takes the free space and
 *   scrolls sideways if it ever runs out. The collapsed narrow-screen
 *   disclosure still wraps. Opt-in, so the six-step journey (more items,
 *   retired by #438) keeps wrapping as before.
 * - **Room for wider text (`singleLineNav`).** The 44 px theme buttons
 *   (`demo-ui.md` §5.6; template 36 px) cost 18 px the template never had,
 *   and Linux/Windows render the same labels ~4 % wider than macOS (the CI
 *   runner overflowed the nav by 22 px when the header had ~1 px to spare).
 *   So the role-aware header keeps ~80 px of free nav width at 1280 px:
 *   template header chips (`Badge size="compact"`, 22 px), and from the
 *   `@6xl` container width (the full 1200 px desktop row) 8 px between the
 *   brand and its badges (template 12), 16 px from them to the nav
 *   (template 24) and 8 px from the nav to the actions (template 24; the
 *   nav's own free width sits there, so the visible gap is larger). Links use
 *   8 px side padding and no gap (template: 12 px plus a 4 px gap; text to
 *   text 16 px). Below `@6xl` the gaps stay at the template's values, so a
 *   scrolling nav never runs into the theme switcher.
 * - **Testnet badge.** Defaults to the canonical `microcopy.testnetBadge`
 *   (the six-step journey keeps it); the role-aware header passes the
 *   template's `TESTNET` through `testnetLabel` (`demo-ui.md` §2: "Badge
 *   `TESTNET` en encabezado fijo") and keeps the full note in its footer.
 * - **Brand token, not HeroUI accent.** The template's `--accent` is the
 *   purple brand (`#8a05be`), which is the app's `--color-brand-accent`.
 *   HeroUI's own `--color-accent` is blue and would read as a different brand,
 *   so the active underline uses `border-brand-accent` and never
 *   `border-accent`. The template vocabulary the header needs now exists as
 *   tokens (`--color-control`, `--color-raised`, `--color-brand-accent-tint`,
 *   `--color-brand-accent-text`, `--color-on-accent`; Slice 2), and the badge
 *   chips carry their own template treatments through `Badge` (Slice 3).
 * - **Collapse without a colour-only signal.** The narrow-screen disclosure is
 *   a real button with `aria-expanded`/`aria-controls` and real state — not a
 *   bare `hidden md:flex`. The responsiveness keys off a container query
 *   (`@container` + `@md:*`) rather than the viewport so the collapsed state
 *   is reproducible and interactive inside a fixed-width Storybook canvas; in
 *   the app the container is the page width, so the breakpoint behaves like
 *   `md:`. The active item's cue is the 2px underline *shape* plus weight;
 *   colour only reinforces it, so it stays legible without colour (WCAG 2.2
 *   AA).
 * - **`actions` slot.** The right end of the header is an optional
 *   `ReactNode` so the `AccountMenu` from T2 drops in without changing this
 *   component.
 */
export interface DemoNavItem {
  readonly label: string;
  readonly href: string;
  /** Marks the active route: renders `aria-current="page"` plus the underline. */
  readonly current?: boolean;
}

export interface DemoNavbarProps {
  readonly items: readonly DemoNavItem[];
  /** Brand link target. Defaults to "/". */
  readonly brandHref?: string;
  /** Accessible name of the primary nav landmark. Defaults to "Principal". */
  readonly navLabel?: string;
  /** Right-end slot, e.g. the future `AccountMenu`. */
  readonly actions?: ReactNode;
  /** Testnet badge label. Defaults to the canonical `microcopy.testnetBadge`. */
  readonly testnetLabel?: string;
  /** Keeps the nav on one line from `@md` up, as the template header does. */
  readonly singleLineNav?: boolean;
  readonly className?: string;
}

export function DemoNavbar({
  items,
  brandHref = "/",
  navLabel = "Principal",
  actions,
  testnetLabel = microcopy.testnetBadge,
  singleLineNav = false,
  className
}: DemoNavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navId = useId();

  return (
    <header
      className={`sticky top-0 z-10 border-b border-border bg-canvas ${className ?? ""}`.trim()}
    >
      <div className="@container mx-auto max-w-[1264px] px-8 py-3">
        <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 ${singleLineNav ? "@6xl:gap-x-2" : ""}`.trim()}>
          <div className={`flex items-center ${singleLineNav ? "gap-3 @6xl:gap-2" : "gap-3"}`}>
            <Link
              href={brandHref}
              aria-label="Vaqcrow, inicio"
              className="flex items-center gap-2 text-text-primary no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <BrandIsotipo />
              <span className="text-[19px] font-bold tracking-[-0.02em]">Vaqcrow</span>
            </Link>
            <Badge variant="demo" label="DEMO" size="compact" />
            <Badge
              variant="testnet"
              size="compact"
              label={testnetLabel}
              icon={IoGitNetworkOutline}
              lang="es"
            />
          </div>

          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={navId}
            onClick={() => setIsOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring @md:hidden"
          >
            {isOpen ? (
              <IoCloseOutline aria-hidden="true" focusable="false" className="text-[18px]" />
            ) : (
              <IoMenuOutline aria-hidden="true" focusable="false" className="text-[18px]" />
            )}
            Menú
          </button>

          <nav
            id={navId}
            aria-label={navLabel}
            data-state={isOpen ? "open" : "closed"}
            className={`${
              isOpen ? "flex" : "hidden"
            } order-last w-full flex-wrap items-center @md:order-none @md:flex @md:w-auto @md:min-w-0 @md:flex-1 ${
              singleLineNav ? "gap-0 @6xl:ml-2 @md:flex-nowrap @md:overflow-x-auto @md:[scrollbar-width:none]" : "gap-1"
            }`}
          >
            {items.map((item, index) => (
              <Link
                key={`${item.href}-${index}`}
                href={item.href}
                {...(item.current ? { "aria-current": "page" as const } : {})}
                className={`flex h-11 items-center whitespace-nowrap text-sm ${singleLineNav ? "px-2" : "px-3"} ${
                  item.current
                    ? "border-b-2 border-brand-accent font-semibold text-text-primary"
                    : "font-medium text-text-secondary hover:text-text-primary"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}
