# Adapt the demo MVP's web surface to the Claude Design template

ODD feature document for the work that follows the source-of-truth decision. This is the record and
the plan; the implementation is the next work unit, not part of this one.

## Objective

Adapt the demo MVP's web surface in `apps/web` — the seven pages `/`, `/request`, `/ai-assessment`,
`/approval`, `/funding`, `/distribution` and `/evidence` — to the visual language of the **Claude
Design template** (`docs/design/template/`), so the demo looks like the template instead of
approximating it. No route is added or removed by this work: the surface stays the seven pages that
exist today.

## Decision (owner, 2026-10-01)

**The Claude Design template wins over the written brief wherever they conflict.** The template — 14
screens in `docs/design/template/`, shared at
<https://claude.ai/design/p/d16823bf-de57-404f-a94b-6a3ad638a770?file=Vaqcrow+Landing.html&via=share> —
is the **source of truth for the visual language**, adopted as it is. The written brief and
`demo-ui.md` remain valuable as *intent and rationale*, but where they contradict the template, **the
template prevails**.

The conflict is **bounded**: the template's core palette and status values are byte-identical to
`demo-ui.md` §5.3/§5.4, so only typography, container width, the decorative gloss, the extra tokens
and the success tone are actually in play.

Where a difference is a **rule** (trust or accessibility) rather than a matter of taste,
`demo-ui.md` §2 still prevails over the template — that is the line the reconciliation draws.
`docs/design/demo-ui.md` now states it (§ top callout, §5.1, §5.4, §5.5, §5.6); the brief carries a
dated precedence callout that leaves its original text intact.

### Contradictions (verified by a read-only audit)

| The template does | The written corpus says |
|---|---|
| **Geist + Geist Mono** (loaded from Google Fonts; root `font-family:'Geist',system-ui,sans-serif`; Geist Mono for hashes/IDs) | **Inter** — `docs/design/demo-ui.md` §5.5 and `docs/design/claude-design-brief.md` §4.2 |
| Container **max-width 1264 px**, padding 32 px | **1200 px** — `demo-ui.md` §5.6, brief §4.3 |
| **Glossy 3D purple spheres** with radial gradients and stacked shadows, and `--accent-tint` eyebrow pills | brief §3.4 **prohibits** "gradientes intensos", "monedas flotantes", "sombras pesadas" |
| Defines a **superset** of tokens: `--accent-hover`, `--accent-tint`, `--accent-text`, `--on-accent`, `--logo`, `--control`, `--raised`, `--stripe`, `--skel`, `--chart`, `--grid`, `--shadow` | `demo-ui.md` §5.4 defines none of these |
| Has a **green success** tone (`--ok-s`/`--ok-t`, a "Confirmada" chip) | the app deliberately has no success tone; brief §6 says green must never be the only success signal |

## Current state (verified by the audit — not re-derived here)

The demo MVP already lines up with the template on some axes and diverges on others:

- **Palette:** already matches the core values — `#8a05be` accent, canvas, surfaces and text
  (`apps/web/src/app/globals.css` lines 41–47). Nothing to change at the core.
- **Fonts:** the app loads **no font at all** — `apps/web/src/app/layout.tsx` uses no `next/font`
  and declares no family; the browser falls back to a system sans.
- **Scales:** there are **no radius, spacing, type-scale or elevation tokens** in `globals.css`; the
  primitives hardcode whatever they need locally.
- **Status palette:** the app's status values **differ** from the template —
  `--color-trust-info: #2563eb` and `--color-trust-critical: #b91c1c`
  (`globals.css` lines 31, 33) against the template's `#1D4E89` / `#A12622`.
- **Copy:** nav and step copy are in **English** — `apps/web/src/application/navigation/demo-steps.ts`
  labels are `Request`, `AI Assessment`, `Approval`, `Funding`, `Distribution`, `Evidence`, and the
  stepper renders `Step 4 of 6` (e.g. `demo-progress.test.tsx`). The design corpus requires neutral
  Argentine Spanish.
- **Component base:** the app uses **HeroUI v3.2.6** (`@heroui/react` `^3.2.6`), whose default accent
  is blue, so **brand and primary can diverge**. The app partially works around this already: the
  navbar deliberately uses `border-brand-accent` / `--color-brand-accent` instead of HeroUI's
  `--accent` (`demo-navbar.tsx` lines 25–30), but the workaround is local, not systemic.
- **Routing:** `/` **redirects to `/request`** (`apps/web/src/app/page.tsx`); there is no landing.
- **Identity:** there is **no isotipo asset** in `apps/web` (the design corpus approves the bull-head
  mark but its source file is still pending; `demo-ui.md` §5.2).

### What already exists (grounding, so the plan is not read as greenfield)

The shared primitives and the shell are **not** missing. The template build order's steps 1–5 (primitives
#306, feedback/trust #310, data #314, navigation shell #318, transaction-review modal #321) are merged and
exercised in Storybook, and their demo-route adoption is recorded in
[[odd/tasks/claude-design-shell-and-review-adoption|claude-design-shell-and-review-adoption]]. In the tree
today `apps/web/src/presentation/components/` already contains `button`, `badge`, `text-field`, `text-area`,
`select`, `combo-box`, `slider`, `chip-toggle-group`, `card`-adjacent `campaign-card`, `trust-banner`,
`canonical-disclosure`, `empty-state`, `error-state`, `skeleton`, `hash-display`, `progress-bar`,
`kpi-tile`, `bar-chart`, `timeline`, `demo-navbar`, `site-footer`, `account-menu`, `theme-switcher`,
`transaction-review-modal` and the rest. So **slices 3 and 4 below are alignment passes on existing
components**, not “build them from scratch” — the gap the audit names is the *foundation underneath them*
(font, token vocabulary, scales, status values, accent strategy), and the exact-fidelity delta of each
primitive/shell component against the template.

## The plan (slices, cheapest first)

Each slice is a work unit with its own verification and its own commit(s), shipped in this order. The
order is deliberate: copy and foundation are pure wins with no design dependency, and the per-screen
pass is cheapest last because it consumes everything above it.

### Slice 1 — Spanish copy pass (mechanical, no design dependency)

Translate the visible chrome copy from English to neutral Argentine Spanish: the six step labels in
`application/navigation/demo-steps.ts` (`Request` → `Solicitud`, `AI Assessment` → `Evaluación de IA`,
`Approval` → `Aprobación`, `Funding` → `Fondeo`, `Distribution` → `Distribución`, `Evidence` →
`Evidencia`), the `Step n of 6` template string, and any other user-visible English chrome. This is the
one slice that can land before any visual decision.

**No decision needed.** Neutral Argentine Spanish is already the corpus requirement
(`claude-design-brief.md` §1 and §6.3, `demo-ui.md` §10.1); this slice only makes the code obey it.
Routes/slugs (URLs) are **not** renamed — only visible copy.

**Verification:** the existing navigation/shell tests updated to the Spanish strings
(`demo-progress.test.tsx`, `demo-shell.test.tsx`, `(demo)/layout.traversal.test.tsx`), the
prohibited-terms guard still green, and a Playwright run that asserts no English step label remains.

### Slice 2 — Foundation in `globals.css` + `layout.tsx` (everything inherits from here)

- **Font:** load **Geist** and **Geist Mono** (template: `Vaqcrow Sistema.dc.html` line 12; root
  `font-family:'Geist',system-ui,sans-serif`, line 27), wire Geist Mono for hashes/IDs, and keep a
  deterministic system fallback.
- **Token vocabulary:** add the template's token names and values to `@theme` — `--accent-hover`,
  `--accent-text`, `--accent-tint`, `--on-accent`, `--logo`, `--control`, `--raised`, `--stripe`,
  `--skel`, `--chart`, `--grid`, `--shadow` — without colliding with the reserved HeroUI names the
  file's own comment already documents (`globals.css` lines 19–27). `demo-ui.md` §5.4 now carries the
  full table with the template file and line for each value, and names the template as their authority.
- **Scales:** add the radius scale (10 / 16 / 24 / 999), the 4 px spacing scale
  (4, 8, 12, 16, 24, 32, 48, 64, 96), the 1 px / 2 px-focus border rule and the single-elevation rule
  (one shadow, dialogs/drawers only). All are in `Vaqcrow Sistema.dc.html` §03 (lines 149–171).
- **Container:** move the layout to the template's **1264 px / 32 px** container.
- **Status values:** align the app's status/chart tokens to the template — `#1D4E89` and `#A12622`
  (the app's `#2563eb` / `#b91c1c` are the divergence the audit names). Wait for the measured WCAG AA
  pass before trusting them, exactly as `globals.css` already notes for its own values.
- **Accent strategy:** decide how HeroUI's primitives carry the brand purple instead of blue. The
  navbar's local `border-brand-accent` workaround (`demo-navbar.tsx` lines 25–30) is the pattern; the
  foundation should make it the default so HeroUI's buttons, focus rings and active states take the
  brand accent system-wide rather than case by case.

**No decision needed:** font (Geist is decided), container (1264 px is decided), the token names/values
and the scales (the template is the authority), the status hexes (the template's values).
**Needs a decision:** the **accent strategy** for HeroUI — how brand and primary are reconciled without
breaking HeroUI's own accessible states and without forking its stylesheet. This is an implementation
decision the slice has to make and record.

**Verification:** Geist actually loads in the built app (assert the font-family on a rendered route and
that the webfont request is emitted); every token is present and resolves in both themes; the status
values match the template; a HeroUI button/focus renders the brand purple, not blue.

### Slice 3 — Primitives (buttons, badges, inputs, cards/surfaces, banners)

Align the existing components in `apps/web/src/presentation/components/` to the template's rendering:
button variants and heights (template `Vaqcrow Sistema.dc.html` §04), badge/chip forms (including the
`TESTNET`/`SIMULADO`/risk chips), field shells (label, error, `SIMULADO` affordance), card/surface
treatment, and the trust banner. This is a fidelity pass on components that already exist — see “What
already exists” above — not their first build.

**No decision needed:** the form and states are already specified (`demo-ui.md` §7, the template §04/§05).
**Needs a decision:** whether the **success tone** is adopted here in the primitives (the template's
`--ok-s`/`--ok-t` "Confirmada" chip) while keeping §2's “pending is not confirmed”. The decision above
already bounds it — green only for confirmed-in-ledger outcomes, never the only signal — so the slice
implements within that bound; it just has to confirm the mapping in `BadgeTone`.

**Verification:** per-component tests plus Storybook stories in both themes; the trust guards
(`canonical-disclosure`, `trust-banner`, prohibited-terms) still pass.

### Slice 4 — Shell (header, footer, theme control, isotipo)

Bring `demo-navbar`, `site-footer`, `account-menu` and `theme-switcher` to the template's shell: fixed
header with brand + `DEMO` + `TESTNET`, primary navigation, the `Claro`/`Oscuro`/`Sistema` control, and
the footer carrying the “No apto para producción” disclosure (template `Vaqcrow Sistema.dc.html`
lines 29–55, 416–430). Add the **isotipo** to the header when its source asset exists.

**No decision needed:** the shell structure and disclosure are already specified.
**Needs a decision:** the **isotipo source asset** — `demo-ui.md` §5.2 says the approved bull-head mark
needs a versioned source file, and the repository has none; the shell cannot ship the mark until that
file is incorporated. Until then the shell keeps the wordmark without the symbol.

**Verification:** shell/layout tests (structural, Spanish, both themes), a Playwright check that the
disclosure and badges are visible without interaction, and — once the asset lands — an isotipo
variant/size check against §5.2.

### Slice 5 — Per-screen, cheapest first

Apply the foundation, primitives and shell to each of the seven routes, cheapest first:

1. `/` — currently just a redirect to `/request`; decide with the owner whether it stays a redirect or
   becomes the template's Landing (see Out of scope).
2. `/request`, `/approval` — already the most template-shaped (they back the vertical journey).
3. `/ai-assessment`, `/distribution` — data-heavy, depend on the chart/table primitives.
4. `/funding` — the wallet + transaction-review flow; depends on the accent strategy and the modal.
5. `/evidence` — the widest surface; last because it consumes the most.

**No decision needed:** each route's content/states are already specified (`demo-ui.md` §8 for the six
legacy routes; the brief §5.3 for the wider product).
**Needs a decision:** only the `/` question above.

**Verification:** each route's component tests plus its slice of the Playwright E2E
(solicitud → IA → aprobación → fondeo → distribución → evidencia), in both themes, with the trust
disclosures asserted.

## Implementation status

Cheapest-first, one work unit per slice. Slices 1–2 are shipped; 3–5 remain.

- [x] Slice 1 — Spanish copy pass — commit `beda484a2799998a6219303efe2503e32eeb1b2f`
- [x] Slice 2 — Foundation in `globals.css` + `layout.tsx` — commit `8bca5dd8d631b360921a3d171000ef4161f9aaa6`
- [ ] Slice 3 — Primitives
- [ ] Slice 4 — Shell
- [ ] Slice 5 — Per-screen

Slice 2 accent strategy, recorded here because the slice had to decide it: HeroUI's default accent is blue, so the app overrides HeroUI's **source** variable
`--accent` with the brand purple (`--color-brand-accent`). Everything HeroUI derives from it (`--accent-hover`, `--accent-soft`, `--focus`, the `--color-accent*`
aliases) recomputes, so Button, Radio, Chip, ProgressBar and the other accent-driven primitives take the brand colour system-wide. HeroUI's reserved `--color-*`
aliases are **not** redeclared, so the decision documented in `globals.css` stands.

## Out of scope (unless the owner expands it)

Building the template screens the demo has **no route for** — the landing, the wallet/marketplace
surfaces, and the other product views the 14-screen template designs but the seven-page MVP does not
implement — is **out of scope**. This is a **product-scope decision, not a styling one**: the template
is the visual source of truth *for the surface we build*, and “adopt the template's look” does not by
itself add routes, navigation or product areas to the demo. If the owner wants those screens, it is a
separate scope decision with its own issue, routes and data.

## Verification

Every slice ends at the repository gate: **`pnpm run verify`** (lint + typecheck + test + build +
boundaries + test:boundaries) is the honest, non-negotiable check. On top of it:

- `pnpm --filter @vaqcrow/web test` and the Playwright E2E for the web surface.
- The trust guards must keep passing on every route: `canonical-disclosure`, `trust-banner`, the
  prohibited-terms guard, and the “submitted is never confirmed” checks.
- Both light and dark themes render for every route touched.
- Any value taken from the template cites the template file (and line/region) rather than being
  restated from memory — the entries in `demo-ui.md` §5.4–§5.6 are the reference.

`pnpm run verify` passing is necessary, not sufficient: it proves nothing broke, not that the surface
now matches the template — the per-slice checks above carry that.

## Commits

- `dedd025b091e2018582ec2ee925e45fed620bb99` — `docs(design): make the Claude Design template win over the written brief in demo-ui` (`docs/design/demo-ui.md`).
- `37a6bc52fbcfabf6e17eb813a0cdb89b53c78150` — `docs(design): annotate the Claude Design brief with the template's precedence` (`docs/design/claude-design-brief.md`).
- This document lands in the third commit of the change; its own hash is recorded in the change report.
- `beda484a2799998a6219303efe2503e32eeb1b2f` — `fix(web): translate demo chrome copy to neutral Spanish` (Slice 1).
- `8bca5dd8d631b360921a3d171000ef4161f9aaa6` — `feat(web): load Geist and align the token foundation with the template` (Slice 2).

## Sources

- `docs/design/demo-ui.md` — the live spec; § top callout, §5.1, §5.4, §5.5, §5.6.
- `docs/design/claude-design-brief.md` — the input brief; §4.2, §4.3, §3.4, §6.
- `docs/design/template/Vaqcrow Sistema.dc.html` — tokens, type scale, spacing/geometry/elevation, primitives, shell.
- `docs/design/template/Vaqcrow Landing.dc.html` — `--stripe`.
- `docs/design/template/Vaqcrow Explorar PyMEs.dc.html` — `--skel`.
- `docs/design/template/Vaqcrow Acerca de.dc.html` — the decorative 3D spheres.
- `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`,
  `apps/web/src/application/navigation/demo-steps.ts`, `apps/web/src/presentation/components/`.
- [[odd/tasks/claude-design-shell-and-review-adoption|claude-design-shell-and-review-adoption]] — steps 1–5 and their demo-route adoption.
- [[odd/tasks/design-source-of-truth-claude-design|design-source-of-truth-claude-design]] — the Stitch retirement.
